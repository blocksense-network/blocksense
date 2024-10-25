use blockchain_data_model::in_mem_db::InMemDb;
use feed_registry::registry::SlotTimeTracker;
use feed_registry::types::Repeatability;
use std::collections::HashMap;
use std::fmt::Debug;
use std::io::Error;
use std::sync::Arc;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio::sync::RwLock;
use tokio::time::Duration;
use tracing::{debug, error, info, info_span, trace};
use utils::time::current_unix_time;

use crate::UpdateToSend;

pub async fn votes_result_batcher_loop<
    K: Debug + Clone + std::string::ToString + 'static + std::cmp::Eq + PartialEq + std::hash::Hash,
    V: Debug + Clone + std::string::ToString + 'static,
>(
    mut vote_recv: UnboundedReceiver<(K, V)>,
    batched_votes_send: UnboundedSender<UpdateToSend<K, V>>,
    max_keys_to_batch: usize,
    timeout_duration: u64,
    blockchain_db: Arc<RwLock<InMemDb>>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("votes_result_batcher")
        .spawn_local(async move {
            let span = info_span!("VotesResultBatcher");
            let _guard = span.enter();
            info!("max_keys_to_batch set to {}", max_keys_to_batch);
            info!("timeout_duration set to {}", timeout_duration);

            let mut stt = SlotTimeTracker::new(
                "votes_result_batcher".to_string(),
                Duration::from_millis(timeout_duration),
                current_unix_time(),
            );

            loop {
                let mut updates: HashMap<K, V> = Default::default();
                let mut send_to_contract = false;
                while !send_to_contract {
                    let end_of_voting_slot_ms: i128 =
                        stt.get_duration_until_end_of_current_slot(&Repeatability::Periodic);
                    // Cannot await negative amount of milliseconds; Turn negative to zero;
                    let time_to_await_ms: u64 = if end_of_voting_slot_ms > 0 {
                        end_of_voting_slot_ms as u64
                    } else {
                        0
                    };
                    let time_to_await: Duration = Duration::from_millis(time_to_await_ms);
                    debug!("Slot waiting for {time_to_await:?} to pass...");
                    let var: Result<Option<(K, V)>, tokio::time::error::Elapsed> =
                        actix_web::rt::time::timeout(time_to_await, vote_recv.recv()).await;
                    debug!("Slot woke up");
                    match var {
                        Ok(Some((key, val))) => {
                            info!(
                                "adding {} => {} to updates",
                                key.to_string(),
                                val.to_string()
                            );
                            updates.insert(key, val);
                            send_to_contract = updates.keys().len() >= max_keys_to_batch;
                        }
                        Ok(None) => {
                            debug!("Woke up on empty channel. Flushing batched updates.");
                            send_to_contract = true;
                        }
                        Err(err) => {
                            debug!(
                                "Woke up due to: {}. Flushing batched updates",
                                err.to_string()
                            );
                            send_to_contract = true;
                        }
                    };
                }
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
                    stt.reset_report_start_time();
                }
            }
        })
        .expect("Failed to spawn votes result batcher!")
}

#[cfg(test)]
mod tests {
    use blockchain_data_model::in_mem_db::InMemDb;
    use std::sync::Arc;
    use std::time::Duration;
    use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
    use tokio::sync::{mpsc, RwLock};
    use tokio::time;

    use crate::UpdateToSend;

    #[actix_web::test]
    async fn test_votes_result_batcher_loop() {
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

        super::votes_result_batcher_loop(
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
