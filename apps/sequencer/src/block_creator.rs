use actix_web::web::Data;
use alloy::hex;
use blocksense_blockchain_data_model::in_mem_db::InMemDb;
use blocksense_blockchain_data_model::{
    MAX_ASSET_FEED_UPDATES_IN_BLOCK, MAX_FEED_ID_TO_DELETE_IN_BLOCK, MAX_NEW_FEEDS_IN_BLOCK,
};
use blocksense_config::BlockConfig;
use blocksense_data_feeds::feeds_processing::VotedFeedUpdateWithProof;
use blocksense_feed_registry::feed_registration_cmds::{
    DeleteAssetFeed, FeedsManagementCmds, RegisterNewAssetFeed,
};
use blocksense_feed_registry::registry::SlotTimeTracker;
use blocksense_feed_registry::types::Repeatability;
use blocksense_registry::config::FeedConfig;
use blocksense_utils::time::{current_unix_time, system_time_to_millis};
use rdkafka::producer::FutureRecord;
use rdkafka::util::Timeout;
use serde_json::json;
use std::collections::{HashMap, VecDeque};
use std::io::Error;
use std::mem;
use std::sync::Arc;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio::sync::RwLock;
use tokio::time::Duration;
use tracing::{debug, error, info, info_span, warn};

use crate::feeds::feed_config_conversions::feed_config_to_block;
use crate::sequencer_state::SequencerState;
use blocksense_data_feeds::feeds_processing::BatchedAggegratesToSend;

pub async fn block_creator_loop(
    sequencer_state: Data<SequencerState>,
    mut aggregated_votes_to_block_creator_recv: UnboundedReceiver<VotedFeedUpdateWithProof>,
    mut feed_management_cmds_recv: UnboundedReceiver<FeedsManagementCmds>,
    batched_votes_send: UnboundedSender<BatchedAggegratesToSend>,
    block_config: BlockConfig,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("block_creator")
        .spawn_local(async move {
            let span = info_span!("BlockCreator");
            let _guard = span.enter();
            let mut max_feed_updates_to_batch = block_config.max_feed_updates_to_batch;
            let block_generation_period = block_config.block_generation_period;

            info!(
                "max_feed_updates_to_batch set to {}",
                max_feed_updates_to_batch
            );
            if max_feed_updates_to_batch > MAX_ASSET_FEED_UPDATES_IN_BLOCK {
                warn!("max_feed_updates_to_batch set to {}, which is above what can fit in a block. Value will be reduced to {}", max_feed_updates_to_batch, MAX_ASSET_FEED_UPDATES_IN_BLOCK);
                max_feed_updates_to_batch = MAX_ASSET_FEED_UPDATES_IN_BLOCK;
            }
            info!("block_generation_period set to {}", block_generation_period);

            let block_genesis_time = match block_config.genesis_block_timestamp {
                Some(genesis_time) => system_time_to_millis(genesis_time),
                None => current_unix_time(),
            };

            let block_generation_time_tracker = SlotTimeTracker::new(
                "block_creator_loop".to_string(),
                Duration::from_millis(block_generation_period),
                block_genesis_time,
            );

            // Updates that overflowed the capacity of a block
            let mut backlog_updates: VecDeque<VotedFeedUpdateWithProof> = Default::default();
            let mut updates: Vec<VotedFeedUpdateWithProof> = Default::default();

            let mut new_feeds_to_register = Vec::new();
            let mut feeds_ids_to_delete = Vec::new();

            let backlog_updates = &mut backlog_updates;
            let updates = &mut updates;

            let new_feeds_to_register = &mut new_feeds_to_register;
            let feeds_ids_to_delete = &mut feeds_ids_to_delete;

            loop {
                // Loop forever
                tokio::select! {
                     // This is the block generation slot
                    _ = block_generation_time_tracker
                    .await_end_of_current_slot(&Repeatability::Periodic) => {
                         // Only emit a block if data is present
                        if !updates.is_empty() || !new_feeds_to_register.is_empty() || !feeds_ids_to_delete.is_empty() {
                            debug!("Emitting block, since there is data present...");
                            if let Err(e) = generate_block(
                                updates,
                                new_feeds_to_register,
                                feeds_ids_to_delete,
                                &batched_votes_send,
                                &sequencer_state,
                                (block_generation_time_tracker.get_last_slot() + 1) as u64,
                            ).await {
                                panic!("Failed to generate block! {e}");
                            };

                            updates.clear();
                            new_feeds_to_register.clear();
                            feeds_ids_to_delete.clear();

                            // Fill the updates that overflowed the capacity of the last block
                            while let Some(v) = backlog_updates.pop_front() {
                                if updates.len() == max_feed_updates_to_batch {
                                    break;
                                }
                                updates.push(v);
                            }
                        }
                    }

                    feed_update = aggregated_votes_to_block_creator_recv.recv() => {
                        debug!("Received votes over `aggregated_votes_to_block_creator_recv`: {feed_update:?}");
                        recvd_feed_update_to_block(feed_update, updates, backlog_updates, max_feed_updates_to_batch, &sequencer_state.active_feeds).await;
                    }

                    feed_management_cmd = feed_management_cmds_recv.recv() => {
                        recvd_feed_management_cmd_to_block(feed_management_cmd, new_feeds_to_register, feeds_ids_to_delete);
                    }
                }
            }
        })
        .expect("Failed to spawn block creator!")
}

// When we recv feed updates that have passed aggregation, we prepare them to be placed in the next generated block
async fn recvd_feed_update_to_block(
    recvd_feed_update: Option<VotedFeedUpdateWithProof>,
    updates_to_block: &mut Vec<VotedFeedUpdateWithProof>,
    backlog_updates: &mut VecDeque<VotedFeedUpdateWithProof>,
    max_feed_updates_to_batch: usize,
    feeds_config: &Arc<RwLock<HashMap<u32, FeedConfig>>>,
) {
    match recvd_feed_update {
        Some(voted_update) => {
            let digits_in_fraction: usize = {
                if let Some(feed_config) =
                    feeds_config.read().await.get(&voted_update.update.feed_id)
                {
                    feed_config.additional_feed_info.decimals.into()
                } else {
                    error!("Propagating result for unregistered feed {}! Support left for legacy one shot feeds of 32 bytes size. Decimal default to 18", voted_update.update.feed_id);
                    18
                }
            };

            let (key, val) = voted_update.update.encode(
                digits_in_fraction,
                voted_update.update.end_slot_timestamp as u64,
            );
            info!("adding {:?} => {:?} to updates", key, val);
            if updates_to_block.len() < max_feed_updates_to_batch {
                updates_to_block.push(voted_update);
            } else {
                warn!(
                    "updates.keys().len() >= max_feed_updates_to_batch ({} >= {})",
                    updates_to_block.len(),
                    max_feed_updates_to_batch
                );
                backlog_updates.push_back(voted_update);
            }
        }
        None => {
            info!("Woke up on empty channel");
        }
    };
}

// When we recv feed management commands, we prepare them to be placed in the next generated block
fn recvd_feed_management_cmd_to_block(
    feed_management_cmd: Option<FeedsManagementCmds>,
    new_feeds_to_register: &mut Vec<RegisterNewAssetFeed>,
    feeds_ids_to_delete: &mut Vec<DeleteAssetFeed>,
) {
    match feed_management_cmd {
        Some(cmd) => match cmd {
            FeedsManagementCmds::RegisterNewAssetFeed(reg_cmd) => {
                if new_feeds_to_register.len() < MAX_NEW_FEEDS_IN_BLOCK {
                    new_feeds_to_register.push(reg_cmd);
                } else {
                    error!(
                        "new_feeds_to_register.len() >= MAX_NEW_FEEDS_IN_BLOCK ({} >= {})",
                        new_feeds_to_register.len(),
                        MAX_NEW_FEEDS_IN_BLOCK
                    );
                }
            }
            FeedsManagementCmds::DeleteAssetFeed(rm_cmd) => {
                if feeds_ids_to_delete.len() < MAX_FEED_ID_TO_DELETE_IN_BLOCK {
                    feeds_ids_to_delete.push(rm_cmd);
                } else {
                    error!(
                        "feeds_ids_to_delete.len() < MAX_FEED_ID_TO_DELETE_IN_BLOCK ({} >= {})",
                        feeds_ids_to_delete.len(),
                        MAX_FEED_ID_TO_DELETE_IN_BLOCK
                    );
                }
            }
        },
        None => info!("Woke up on empty channel - feed_management_cmds_recv"),
    }
}

async fn generate_block(
    updates: &mut Vec<VotedFeedUpdateWithProof>,
    new_feeds_to_register: &mut Vec<RegisterNewAssetFeed>,
    feeds_ids_to_delete: &mut Vec<DeleteAssetFeed>,
    batched_votes_send: &UnboundedSender<BatchedAggegratesToSend>,
    sequencer_state: &Data<SequencerState>,
    block_height: u64,
) -> eyre::Result<()> {
    let sequencer_id = sequencer_state.sequencer_config.read().await.sequencer_id;
    let new_feeds_to_register = mem::take(new_feeds_to_register);
    let feeds_ids_to_delete = mem::take(feeds_ids_to_delete);
    let updates = mem::take(updates);

    let mut new_feeds_in_block = Vec::new();
    for register_new_asset_feed in &new_feeds_to_register {
        new_feeds_in_block.push(feed_config_to_block(&register_new_asset_feed.config));
    }

    let mut feeds_ids_to_delete_in_block = Vec::new();
    for delete_feed_id_cmd in &feeds_ids_to_delete {
        feeds_ids_to_delete_in_block.push(delete_feed_id_cmd.id);
    }

    let block_is_empty = new_feeds_to_register.is_empty() && feeds_ids_to_delete.is_empty();
    let mut serialized_header = Vec::new();
    let mut serialized_feed_actions = Vec::new();
    // Block holding the db write mutex:
    if !block_is_empty {
        // Create the block that will contain the new feeds, deleted feeds and updates of feed values
        let mut blockchain_db = sequencer_state.blockchain_db.write().await;
        let (header, feed_actions) = blockchain_db
            .create_new_block(
                sequencer_id,
                block_height,
                new_feeds_in_block,
                feeds_ids_to_delete_in_block,
            )
            .map_err(|e| eyre::eyre!(e.to_string()))?;
        serialized_header = match header.clone().serialize() {
            Ok(res) => res,
            Err(e) => {
                panic!("could not serialize block header: {e}")
            }
        };
        serialized_feed_actions = match feed_actions.clone().serialize() {
            Ok(res) => res,
            Err(e) => {
                panic!("could not serialize block feed_actions: {e}")
            }
        };
        let header_merkle_root = InMemDb::calc_merkle_root(&mut header.clone())
            .map_err(|e| eyre::eyre!(e.to_string()))?;
        info!(
            "Generated new block {:?} with hash {:?}",
            header,
            InMemDb::node_to_hash(header_merkle_root).map_err(|e| eyre::eyre!(e.to_string()))?
        );
        if let Err(e) = blockchain_db.add_next_block(header, feed_actions) {
            eyre::bail!(e.to_string());
        }
    }

    // Process feed updates:
    if !updates.is_empty() {
        debug!("Sending batched votes over `batched_votes_send`...");

        let mut value_updates = Vec::new();
        let mut proofs = HashMap::new();
        for v in updates {
            let feed_id = v.update.feed_id;
            value_updates.push(v.update);
            proofs.insert(feed_id, v.proof);
        }

        if let Err(e) = batched_votes_send.send(BatchedAggegratesToSend {
            block_height,
            updates: value_updates,
        }) {
            error!(
                "Channel for propagating batched updates to sender failed: {}",
                e.to_string()
            );
        }
    }

    // Process cmds to register new feeds:
    for cmd in new_feeds_to_register {
        match sequencer_state
            .feeds_slots_manager_cmd_send
            .send(FeedsManagementCmds::RegisterNewAssetFeed(cmd))
        {
            Ok(_) => info!("forward register cmd"),
            Err(e) => error!("Could not forward register cmd: {e}"),
        };
    }

    // Process cmds to delete existing feeds:
    for cmd in feeds_ids_to_delete {
        match sequencer_state
            .feeds_slots_manager_cmd_send
            .send(FeedsManagementCmds::DeleteAssetFeed(cmd))
        {
            Ok(_) => info!("forward delete cmd"),
            Err(e) => error!("Could not forward delete cmd: {e}"),
        };
    }

    if !block_is_empty {
        let block_to_kafka = json!({
            "BlockHeader": hex::encode(serialized_header),
            "FeedActions": hex::encode(serialized_feed_actions),
        });

        if let Some(kafka_endpoint) = &sequencer_state.kafka_endpoint {
            match kafka_endpoint
                .send(
                    FutureRecord::<(), _>::to("blockchain").payload(&block_to_kafka.to_string()),
                    Timeout::Never,
                )
                .await
            {
                Ok(res) => debug!("Successfully sent block to kafka endpoint: {res:?}"),
                Err(e) => error!("Failed to send to kafka endpoint! {e:?}"),
            }
        } else {
            warn!("No Kafka endpoint set to stream blocks");
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::sequencer_state::create_sequencer_state_from_sequencer_config;
    use blocksense_config::get_test_config_with_no_providers;
    use blocksense_config::AllFeedsConfig;
    use blocksense_config::BlockConfig;
    use blocksense_data_feeds::feeds_processing::VotedFeedUpdate;
    use blocksense_data_feeds::feeds_processing::VotedFeedUpdateWithProof;
    use blocksense_feed_registry::types::{FeedType, Timestamp};
    use std::time::Duration;
    use tokio::sync::mpsc;
    use tokio::time;

    #[actix_web::test]
    async fn test_block_creator_loop() {
        // Setup
        let block_config = BlockConfig {
            max_feed_updates_to_batch: 3,
            block_generation_period: 100,
            genesis_block_timestamp: None,
            aggregation_consensus_discard_period_blocks: 100,
        };

        let sequencer_config = get_test_config_with_no_providers();
        let feeds_config = AllFeedsConfig { feeds: vec![] };
        let metrics_prefix = "test_block_creator_loop";
        let (
            sequencer_state,
            aggregated_votes_to_block_creator_recv,
            feeds_management_cmd_to_block_creator_recv,
            _feeds_slots_manager_cmd_recv,
            _aggregate_batch_sig_recv,
        ) = create_sequencer_state_from_sequencer_config(
            sequencer_config,
            metrics_prefix,
            feeds_config,
        )
        .await;

        let (batched_votes_send, mut batched_votes_recv) = mpsc::unbounded_channel();
        let vote_send = sequencer_state
            .aggregated_votes_to_block_creator_send
            .clone();
        super::block_creator_loop(
            sequencer_state,
            aggregated_votes_to_block_creator_recv,
            feeds_management_cmd_to_block_creator_recv,
            batched_votes_send,
            block_config,
        )
        .await;
        let end_of_timeslot: Timestamp = 0;

        // Send test votes
        let k1 = "ab000001";
        let v1 = "000000000000000000000000000010f0da2079987e1000000000000000000000";
        let vote_1 = VotedFeedUpdateWithProof {
            update: VotedFeedUpdate::new_decode(
                k1,
                v1,
                end_of_timeslot,
                FeedType::Numerical(0.0),
                18,
            )
            .unwrap(),
            proof: Vec::new(),
        };
        let k2 = "ac000002";
        let v2 = "000000000000000000000000000010f0da2079987e2000000000000000000000";
        let vote_2 = VotedFeedUpdateWithProof {
            update: VotedFeedUpdate::new_decode(
                k2,
                v2,
                end_of_timeslot,
                FeedType::Numerical(0.0),
                18,
            )
            .unwrap(),
            proof: Vec::new(),
        };
        let k3 = "ad000003";
        let v3 = "000000000000000000000000000010f0da2079987e3000000000000000000000";
        let vote_3 = VotedFeedUpdateWithProof {
            update: VotedFeedUpdate::new_decode(
                k3,
                v3,
                end_of_timeslot,
                FeedType::Numerical(0.0),
                18,
            )
            .unwrap(),
            proof: Vec::new(),
        };
        let k4 = "af000004";
        let v4 = "000000000000000000000000000010f0da2079987e4000000000000000000000";
        let vote_4 = VotedFeedUpdateWithProof {
            update: VotedFeedUpdate::new_decode(
                k4,
                v4,
                end_of_timeslot,
                FeedType::Numerical(0.0),
                18,
            )
            .unwrap(),
            proof: Vec::new(),
        };
        vote_send.send(vote_1).unwrap();
        vote_send.send(vote_2).unwrap();
        vote_send.send(vote_3).unwrap();
        vote_send.send(vote_4).unwrap();

        // Wait for a while to let the loop process the message
        time::sleep(Duration::from_millis(1000)).await;
        assert_eq!(batched_votes_recv.len(), 2);

        // Validate
        if let Some(batched) = batched_votes_recv.recv().await {
            assert_eq!(batched.updates.len(), 3);
        } else {
            panic!("Batched votes were not received");
        }
    }
}
