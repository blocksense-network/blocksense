use actix_web::rt::spawn;
use blockchain_data_model::in_mem_db::InMemDb;
use blockchain_data_model::{
    BlockFeedConfig, DataChunk, Resources, MAX_ASSET_FEED_UPDATES_IN_BLOCK,
    MAX_FEED_ID_TO_DELETE_IN_BLOCK, MAX_NEW_FEEDS_IN_BLOCK,
};
use feed_registry::feed_registration_cmds::FeedsManagementCmds;
use feed_registry::registry::SlotTimeTracker;
use feed_registry::types::Repeatability;
use std::collections::HashMap;
use std::fmt::Debug;
use std::io::Error;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
// use std::sync::{Arc, RwLock};
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio::time::Duration;
use tracing::{error, info, info_span, trace, warn};
use utils::time::current_unix_time;

use crate::UpdateToSend;

pub async fn block_creator_loop<
    K: Debug + Clone + std::string::ToString + 'static + std::cmp::Eq + PartialEq + std::hash::Hash,
    V: Debug + Clone + std::string::ToString + 'static,
>(
    mut vote_recv: UnboundedReceiver<(K, V)>,
    mut feed_management_cmds_recv: UnboundedReceiver<FeedsManagementCmds>,
    feed_manager_cmds_send: UnboundedSender<FeedsManagementCmds>,
    batched_votes_send: UnboundedSender<UpdateToSend<K, V>>,
    mut max_keys_to_batch: usize,
    timeout_duration: u64,
    blockchain_db: Arc<RwLock<InMemDb>>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    spawn(async move {
        let span = info_span!("VotesResultBatcher");
        let _guard = span.enter();
        info!("max_keys_to_batch set to {}", max_keys_to_batch);
        if max_keys_to_batch > MAX_ASSET_FEED_UPDATES_IN_BLOCK {
            warn!("max_keys_to_batch set to {}, which is above what can fit in a block. Value will be reduced to {}", max_keys_to_batch, MAX_ASSET_FEED_UPDATES_IN_BLOCK);
            max_keys_to_batch = MAX_ASSET_FEED_UPDATES_IN_BLOCK;
        }
        info!("timeout_duration set to {}", timeout_duration);

        let mut stt = SlotTimeTracker::new(
            "block_creator_loop".to_string(),
            Duration::from_millis(timeout_duration),
            current_unix_time(),
        );

        loop {
            // Loop forever
            let mut updates: HashMap<K, V> = Default::default();
            let mut new_feeds_to_register = Vec::new();
            let mut feeds_ids_to_delete = Vec::new();
            loop {
                // Loop collecting data, until it is time to emit a block
                tokio::select! {
                    _ = stt
                    .await_end_of_current_slot(&Repeatability::Periodic) => { // This is the block generation slot
                        generate_block(
                            updates,
                            new_feeds_to_register,
                            feeds_ids_to_delete,
                            &batched_votes_send,
                            &blockchain_db,
                            &feed_manager_cmds_send
                        ).await;
                        stt.reset_report_start_time();
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
                                updates.insert(key, val);
                                if updates.keys().len() >= max_keys_to_batch {
                                    generate_block(
                                        updates,
                                        new_feeds_to_register,
                                        feeds_ids_to_delete,
                                        &batched_votes_send,
                                        &blockchain_db,
                                        &feed_manager_cmds_send
                                    ).await;
                                    stt.reset_report_start_time();
                                    break;
                                }
                            }
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
                                        new_feeds_to_register.push(cmd);
                                    },
                                    FeedsManagementCmds::DeleteAssetFeed(_) => {
                                        feeds_ids_to_delete.push(cmd);
                                    },
                                }
                                if new_feeds_to_register.len() >= MAX_NEW_FEEDS_IN_BLOCK ||
                                   feeds_ids_to_delete.len() >= MAX_FEED_ID_TO_DELETE_IN_BLOCK
                                {
                                    generate_block(
                                        updates,
                                        new_feeds_to_register,
                                        feeds_ids_to_delete,
                                        &batched_votes_send,
                                        &blockchain_db,
                                        &feed_manager_cmds_send
                                    ).await;
                                    stt.reset_report_start_time();
                                    break;
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
    for (i, (key, value)) in map.into_iter().take(32).enumerate() {
        resource_keys[i] = Some(string_to_data_chunk(&key));
        resource_values[i] = Some(string_to_data_chunk(&value));
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
    blockchain_db: &Arc<RwLock<InMemDb>>,
    feed_manager_cmds_send: &UnboundedSender<FeedsManagementCmds>,
) {
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

    let block_height;
    {
        // Create the block that will contain the new feeds, deleted feeds and updates of feed values
        let mut blockchain_db = blockchain_db.write().await;
        let (header, feed_updates, add_remove_feeds) = blockchain_db.create_new_block(
            &updates,
            new_feeds_in_block,
            feeds_ids_to_delete_in_block,
        );
        trace!(
            "Generated new block {:?} with hash {:?}",
            header,
            InMemDb::node_to_hash(InMemDb::calc_merkle_root(&mut header.clone()))
        );
        blockchain_db
            .add_next_block(header, feed_updates, add_remove_feeds)
            .expect("Failed to add block!");
        block_height = blockchain_db.get_latest_block_height();
    }

    // Process feed updates:
    if updates.keys().len() > 0 {
        if let Err(e) = batched_votes_send.send(UpdateToSend {
            block_height: block_height,
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
}

#[cfg(test)]
mod tests {
    use blockchain_data_model::in_mem_db::InMemDb;
    use std::sync::Arc;
    use std::time::Duration;
    use tokio::sync::mpsc;
    use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
    use tokio::sync::RwLock;
    use tokio::time;

    use crate::UpdateToSend;

    #[actix_web::test]
    async fn test_block_creator_loop() {
        // Setup
        let batch_size = 3;
        let duration = 100;

        let (vote_send, vote_recv): (
            UnboundedSender<(String, String)>,
            UnboundedReceiver<(String, String)>,
        ) = mpsc::unbounded_channel();
        let (batched_votes_send, mut batched_votes_recv): (
            UnboundedSender<UpdateToSend<String, String>>,
            UnboundedReceiver<UpdateToSend<String, String>>,
        ) = mpsc::unbounded_channel();

        super::block_creator_loop(
            //Arc::new(RwLock::new(vote_recv)),
            vote_recv,
            batched_votes_send,
            batch_size,
            duration,
            Arc::new(RwLock::new(InMemDb::new())),
        )
        .await;

        // Send test votes
        let k1 = "ab000001".to_owned();
        let v1 = "000000000000000000000000000010f0da2079987e1000000000000000000000".to_owned();
        vote_send.send((k1, v1)).unwrap();
        let k2 = "ac000002".to_owned();
        let v2 = "000000000000000000000000000010f0da2079987e2000000000000000000000".to_owned();
        vote_send.send((k2, v2)).unwrap();
        let k3 = "ad000003".to_owned();
        let v3 = "000000000000000000000000000010f0da2079987e3000000000000000000000".to_owned();
        vote_send.send((k3, v3)).unwrap();
        let k4 = "af000004".to_owned();
        let v4 = "000000000000000000000000000010f0da2079987e4000000000000000000000".to_owned();
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
