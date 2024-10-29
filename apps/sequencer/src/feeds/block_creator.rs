use actix_web::rt::spawn;
use blockchain_data_model::in_mem_db::InMemDb;
use blockchain_data_model::MAX_ASSET_FEED_UPDATES_IN_BLOCK;
use feed_registry::registry::SlotTimeTracker;
use feed_registry::types::Repeatability;
use std::collections::HashMap;
use std::fmt::Debug;
use std::io::Error;
use std::sync::Arc;
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
            loop {
                // Loop collecting data, until it is time to emit a block
                tokio::select! {
                    _ = stt
                    .await_end_of_current_slot(&Repeatability::Periodic) => { // This is the block generation slot
                        generate_block(updates, &batched_votes_send, &blockchain_db).await;
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
                                    generate_block(updates, &batched_votes_send, &blockchain_db).await;
                                    stt.reset_report_start_time();
                                    break;
                                }
                            }
                            None => {
                                info!("Woke up on empty channel");
                            }
                        };
                    }
                }
            }
        }
    })
}

async fn generate_block<
    K: Debug + Clone + std::string::ToString + 'static + std::cmp::Eq + PartialEq + std::hash::Hash,
    V: Debug + Clone + std::string::ToString + 'static,
>(
    updates: HashMap<K, V>,
    batched_votes_send: &UnboundedSender<UpdateToSend<K, V>>,
    blockchain_db: &Arc<RwLock<InMemDb>>,
) {
    let block_height;
    {
        let mut blockchain_db = blockchain_db.write().await;
        let (header, feed_updates) = blockchain_db.create_new_block(&updates);
        trace!(
            "Generated new block {:?} with hash {:?}",
            header,
            InMemDb::node_to_hash(InMemDb::calc_merkle_root(&mut header.clone()))
        );
        blockchain_db
            .add_next_block(header, feed_updates)
            .expect("Failed to add block!");
        block_height = blockchain_db.get_latest_block_height();
    }

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
