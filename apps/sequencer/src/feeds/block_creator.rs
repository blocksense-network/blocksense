use actix_web::rt::spawn;
use actix_web::web::Data;
use alloy::hex;
use blockchain_data_model::in_mem_db::InMemDb;
use blockchain_data_model::{
    BlockFeedConfig, DataChunk, Resources, MAX_ASSET_FEED_UPDATES_IN_BLOCK,
    MAX_FEED_ID_TO_DELETE_IN_BLOCK, MAX_NEW_FEEDS_IN_BLOCK,
};
use config::BlockConfig;
use feed_registry::feed_registration_cmds::FeedsManagementCmds;
use feed_registry::registry::SlotTimeTracker;
use feed_registry::types::Repeatability;
use rdkafka::producer::FutureRecord;
use rdkafka::util::Timeout;
use serde_json::json;
use std::collections::{HashMap, VecDeque};
use std::fmt::Debug;
use std::io::Error;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio::time::Duration;
use tracing::{debug, error, info, warn};
use utils::time::{current_unix_time, system_time_to_millis};

use crate::sequencer_state::SequencerState;
use crate::UpdateToSend;

pub async fn block_creator_loop<
    K: Debug + Clone + std::string::ToString + 'static + std::cmp::Eq + PartialEq + std::hash::Hash,
    V: Debug + Clone + std::string::ToString + 'static,
>(
    sequencer_state: Data<SequencerState>,
    mut vote_recv: UnboundedReceiver<(K, V)>,
    mut feed_management_cmds_recv: UnboundedReceiver<FeedsManagementCmds>,
    feed_manager_cmds_send: UnboundedSender<FeedsManagementCmds>,
    batched_votes_send: UnboundedSender<UpdateToSend<K, V>>,
    block_config: BlockConfig,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    spawn(async move {
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
        let mut backlog_updates = VecDeque::new();

        loop {
            // Loop forever
            let mut updates: HashMap<K, V> = Default::default();
            // Fill the updates that overflowed the capacity of the last block
            for _ in 0..max_feed_updates_to_batch {
                if let Some((k, v)) = backlog_updates.pop_front() {
                    updates.insert(k, v);
                } else {
                    break;
                }
            }

            let mut new_feeds_to_register = Vec::new();
            let mut feeds_ids_to_delete = Vec::new();
            loop {
                // Loop collecting data, until it is time to emit a block
                tokio::select! {
                    _ = block_generation_time_tracker
                    .await_end_of_current_slot(&Repeatability::Periodic) => { // This is the block generation slot
                        if !updates.is_empty() || !new_feeds_to_register.is_empty() || !feeds_ids_to_delete.is_empty() { // Only emit a block if data is present
                            generate_block(
                                updates,
                                new_feeds_to_register,
                                feeds_ids_to_delete,
                                &batched_votes_send,
                                &sequencer_state,
                                &feed_manager_cmds_send,
                                (block_generation_time_tracker.get_last_slot() + 1) as u64,
                            ).await;
                        }
                        break;
                    }

                    feed_update = vote_recv.recv() => {
                        match feed_update {
                            Some((key, val)) => {
                                info!(
                                    "adding {} => {} to updates",
                                    key.to_string(),
                                    val.to_string()
                                );
                                if updates.keys().len() < max_feed_updates_to_batch {
                                    updates.insert(key, val);
                                } else {
                                    warn!("updates.keys().len() >= max_feed_updates_to_batch ({} >= {})", updates.keys().len(), max_feed_updates_to_batch);
                                    backlog_updates.push_back((key, val));
                                }
                            },
                            None => {
                                info!("Woke up on empty channel");
                            }
                        };
                    }

                    feed_management_cmd = feed_management_cmds_recv.recv() => {
                        match feed_management_cmd {
                            Some(cmd) => {
                                match &cmd {
                                    FeedsManagementCmds::RegisterNewAssetFeed(_) => {
                                        if new_feeds_to_register.len() < MAX_NEW_FEEDS_IN_BLOCK {
                                            new_feeds_to_register.push(cmd);
                                        } else {
                                            error!("new_feeds_to_register.len() >= MAX_NEW_FEEDS_IN_BLOCK ({} >= {})", new_feeds_to_register.len(), MAX_NEW_FEEDS_IN_BLOCK);
                                        }
                                    },
                                    FeedsManagementCmds::DeleteAssetFeed(_) => {
                                        if feeds_ids_to_delete.len() < MAX_FEED_ID_TO_DELETE_IN_BLOCK {
                                            feeds_ids_to_delete.push(cmd);
                                        } else {
                                            error!("feeds_ids_to_delete.len() < MAX_FEED_ID_TO_DELETE_IN_BLOCK ({} >= {})", feeds_ids_to_delete.len(), MAX_FEED_ID_TO_DELETE_IN_BLOCK);
                                        }
                                    },
                                }
                            },
                            None => info!("Woke up on empty channel - feed_management_cmds_recv"),
                        }
                    }
                }
            }
        }
    })
}

// Helper function to convert SystemTime to u64 (seconds since UNIX_EPOCH)
fn system_time_to_u64(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH)
        .expect("SystemTime should be after UNIX_EPOCH")
        .as_secs()
}

// Helper function to convert f32 to [u8; 4]
fn f32_to_u8_array(value: f32) -> [u8; 4] {
    value.to_be_bytes()
}

// Helper function to convert String to DataChunk ([u8; 32])
fn string_to_data_chunk(input: &str) -> DataChunk {
    let mut chunk = [0u8; 32];
    let bytes = input.as_bytes();
    let len = bytes.len().min(32); // Truncate if longer than 32 bytes
    chunk[..len].copy_from_slice(&bytes[..len]);
    chunk
}

// Function to convert HashMap<String, String> to Resources struct
fn convert_resources(map: &HashMap<String, String>) -> Resources {
    // Initialize arrays with None
    let mut resource_keys: [Option<DataChunk>; 32] = Default::default();
    let mut resource_values: [Option<DataChunk>; 32] = Default::default();

    // Iterate over the HashMap, up to 32 entries
    for (i, (key, value)) in map.iter().take(32).enumerate() {
        resource_keys[i] = Some(string_to_data_chunk(key));
        resource_values[i] = Some(string_to_data_chunk(value));
    }

    Resources {
        resource_keys,
        resource_values,
    }
}

fn feed_config_to_block(feed_config: &config::FeedConfig) -> BlockFeedConfig {
    BlockFeedConfig {
        id: feed_config.id,
        name: string_to_data_chunk(&feed_config.name),
        full_name: string_to_data_chunk(&feed_config.full_name),
        description: string_to_data_chunk(&feed_config.description),
        _type: string_to_data_chunk(&feed_config._type),
        decimals: feed_config.decimals,
        pair: blockchain_data_model::AssetPair {
            base: string_to_data_chunk(feed_config.pair.base.as_str()),
            quote: string_to_data_chunk(feed_config.pair.quote.as_str()),
        },
        report_interval_ms: feed_config.report_interval_ms,
        first_report_start_time: system_time_to_u64(feed_config.first_report_start_time),
        resources: convert_resources(&feed_config.resources),
        quorum_percentage: f32_to_u8_array(feed_config.quorum_percentage),
        script: string_to_data_chunk(&feed_config.script),
        value_type: string_to_data_chunk(&feed_config.value_type),
        aggregate_type: string_to_data_chunk(&feed_config.aggregate_type),
    }
}

async fn generate_block<
    K: Debug + Clone + std::string::ToString + 'static + std::cmp::Eq + PartialEq + std::hash::Hash,
    V: Debug + Clone + std::string::ToString + 'static,
>(
    updates: HashMap<K, V>,
    new_feeds_to_register: Vec<FeedsManagementCmds>,
    feeds_ids_to_delete: Vec<FeedsManagementCmds>,
    batched_votes_send: &UnboundedSender<UpdateToSend<K, V>>,
    sequencer_state: &Data<SequencerState>,
    feed_manager_cmds_send: &UnboundedSender<FeedsManagementCmds>,
    block_height: u64,
) {
    let sequencer_id = sequencer_state.sequencer_config.read().await.sequencer_id;

    let mut new_feeds_in_block = Vec::new();
    for cmd in &new_feeds_to_register {
        match cmd {
            FeedsManagementCmds::RegisterNewAssetFeed(register_new_asset_feed) => {
                new_feeds_in_block.push(feed_config_to_block(&register_new_asset_feed.config));
            }
            FeedsManagementCmds::DeleteAssetFeed(_) => {
                panic!("Logical error: this set should only contan new feeds!")
            }
        }
    }

    let mut feeds_ids_to_delete_in_block = Vec::new();
    for cmd in &feeds_ids_to_delete {
        match cmd {
            FeedsManagementCmds::RegisterNewAssetFeed(_) => {
                panic!("Logical error: this set should only contan feeds ids to delete!")
            }
            FeedsManagementCmds::DeleteAssetFeed(delete_feed_id_cmd) => {
                feeds_ids_to_delete_in_block.push(delete_feed_id_cmd.id);
            }
        }
    }

    let block_is_empty = new_feeds_to_register.is_empty() && feeds_ids_to_delete.is_empty();
    let serialized_header;
    let serialized_add_remove_feeds;
    // Block holding the db write mutex:
    {
        // Create the block that will contain the new feeds, deleted feeds and updates of feed values
        let mut blockchain_db = sequencer_state.blockchain_db.write().await;
        let (header, add_remove_feeds) = blockchain_db.create_new_block(
            sequencer_id,
            block_height,
            new_feeds_in_block,
            feeds_ids_to_delete_in_block,
        );
        serialized_header = header.clone().serialize();
        serialized_add_remove_feeds = add_remove_feeds.clone().serialize();
        if !block_is_empty {
            info!(
                "Generated new block {:?} with hash {:?}",
                header,
                InMemDb::node_to_hash(InMemDb::calc_merkle_root(&mut header.clone()))
            );
            blockchain_db
                .add_next_block(header, add_remove_feeds)
                .expect("Failed to add block!");
        }
    }

    // Process feed updates:
    if updates.keys().len() > 0 {
        if let Err(e) = batched_votes_send.send(UpdateToSend {
            block_height,
            kv_updates: updates,
        }) {
            error!(
                "Channel for propagating batched updates to sender failed: {}",
                e.to_string()
            );
        }
    }

    // Process cmds to register new feeds:
    for cmd in new_feeds_to_register {
        match feed_manager_cmds_send.send(cmd) {
            Ok(_) => info!("forward register cmd"),
            Err(e) => info!("Could not forward register cmd: {e}"),
        };
    }

    // Process cmds to delete existing feeds:
    for cmd in feeds_ids_to_delete {
        match feed_manager_cmds_send.send(cmd) {
            Ok(_) => info!("forward delete cmd"),
            Err(e) => info!("Could not forward delete cmd: {e}"),
        };
    }

    if !block_is_empty {
        let block_to_kafka = json!({
            "BlockHeader": hex::encode(serialized_header),
            "AddRemoveFeeds": hex::encode(serialized_add_remove_feeds),
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
}

#[cfg(test)]
mod tests {
    // use std::sync::{Arc, RwLock};
    use config::BlockConfig;
    use std::time::Duration;
    use tokio::sync::mpsc;
    use tokio::time;
    use utils::test_env::get_test_private_key_path;

    use crate::testing::sequencer_state::create_sequencer_state_from_sequencer_config_file;

    #[actix_web::test]
    async fn test_block_creator_loop() {
        // Setup
        let block_config = BlockConfig {
            max_feed_updates_to_batch: 3,
            block_generation_period: 100,
            genesis_block_timestamp: None,
        };

        let (vote_send, vote_recv) = mpsc::unbounded_channel();
        let (_feeds_management_cmd_send, feeds_management_cmd_recv) = mpsc::unbounded_channel();
        let (feeds_slots_manager_cmd_send, _feeds_slots_manager_cmd_recv) =
            mpsc::unbounded_channel();
        let (batched_votes_send, mut batched_votes_recv) = mpsc::unbounded_channel();

        let key_path = get_test_private_key_path();
        let network = "ETH_test_block_creator_loop";

        let sequencer_state = create_sequencer_state_from_sequencer_config_file(
            network,
            key_path.as_path(),
            "https://127.0.0.1:1234",
            None,
            None,
        )
        .await;

        super::block_creator_loop(
            //Arc::new(RwLock::new(vote_recv)),
            sequencer_state,
            vote_recv,
            feeds_management_cmd_recv,
            feeds_slots_manager_cmd_send,
            batched_votes_send,
            block_config,
        )
        .await;

        // Send test votes
        let k1 = "ab000001";
        let v1 = "000000000000000000000000000010f0da2079987e1000000000000000000000";
        vote_send.send((k1, v1)).unwrap();
        let k2 = "ac000002";
        let v2 = "000000000000000000000000000010f0da2079987e2000000000000000000000";
        vote_send.send((k2, v2)).unwrap();
        let k3 = "ad000003";
        let v3 = "000000000000000000000000000010f0da2079987e3000000000000000000000";
        vote_send.send((k3, v3)).unwrap();
        let k4 = "af000004";
        let v4 = "000000000000000000000000000010f0da2079987e4000000000000000000000";
        vote_send.send((k4, v4)).unwrap();

        // Wait for a while to let the loop process the message
        time::sleep(Duration::from_millis(1000)).await;
        assert_eq!(batched_votes_recv.len(), 2);

        // Validate
        if let Some(batched) = batched_votes_recv.recv().await {
            assert_eq!(batched.kv_updates.len(), 3);
        } else {
            panic!("Batched votes were not received");
        }
    }
}
