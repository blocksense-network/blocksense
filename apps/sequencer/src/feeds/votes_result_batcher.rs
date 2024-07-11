use crate::feeds::feeds_registry::Repeatability;
use crate::utils::time_utils::{get_ms_since_epoch, SlotTimeTracker};
use actix_web::rt::spawn;
use std::collections::HashMap;
use std::fmt::Debug;
use std::io::Error;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio::time::Duration;
use tracing::{debug, error, info, info_span};

pub async fn votes_result_batcher_loop<
    K: Debug + Clone + std::string::ToString + 'static + std::cmp::Eq + PartialEq + std::hash::Hash,
    V: Debug + Clone + std::string::ToString + 'static,
>(
    mut vote_recv: UnboundedReceiver<(K, V)>,
    batched_votes_send: UnboundedSender<HashMap<K, V>>,
    max_keys_to_batch: usize,
    timeout_duration: u64,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    spawn(async move {
        let span = info_span!("VotesResultBatcher");
        let _guard = span.enter();
        info!("max_keys_to_batch set to {}", max_keys_to_batch);
        info!("timeout_duration set to {}", timeout_duration);

        let mut stt = SlotTimeTracker::new(
            Duration::from_millis(timeout_duration),
            get_ms_since_epoch(),
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
                let var: Result<Option<(K, V)>, tokio::time::error::Elapsed> =
                    actix_web::rt::time::timeout(time_to_await, vote_recv.recv()).await;
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
            if updates.keys().len() > 0 {
                if let Err(e) = batched_votes_send.send(updates) {
                    error!(
                        "Channel for propagating batched updates to sender failed: {}",
                        e.to_string()
                    );
                }
            }
            stt.reset_report_start_time();
        }
    })
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::env;
    use std::time::Duration;
    use tokio::sync::mpsc;
    use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
    use tokio::time;

    #[actix_web::test]
    async fn test_votes_result_batcher_loop() {
        // Setup
        let batch_size = 3;
        let duration = 100;

        let (vote_send, vote_recv): (
            UnboundedSender<(&str, &str)>,
            UnboundedReceiver<(&str, &str)>,
        ) = mpsc::unbounded_channel();
        let (batched_votes_send, mut batched_votes_recv): (
            UnboundedSender<HashMap<&str, &str>>,
            UnboundedReceiver<HashMap<&str, &str>>,
        ) = mpsc::unbounded_channel();

        super::votes_result_batcher_loop(vote_recv, batched_votes_send, batch_size, duration).await;

        // Send test votes
        let k1 = "test_key_1";
        let v1 = "test_val_1";
        vote_send.send((k1, v1)).unwrap();
        let k2 = "test_key_2";
        let v2 = "test_val_2";
        vote_send.send((k2, v2)).unwrap();
        let k3 = "test_key_3";
        let v3 = "test_val_3";
        vote_send.send((k3, v3)).unwrap();
        let k4 = "test_key_4";
        let v4 = "test_val_4";
        vote_send.send((k4, v4)).unwrap();

        // Wait for a while to let the loop process the message
        time::sleep(Duration::from_millis(1000)).await;
        assert_eq!(batched_votes_recv.len(), 2);

        // Validate
        if let Some(batched) = batched_votes_recv.recv().await {
            assert_eq!(batched.len(), 3);
        } else {
            panic!("Batched votes were not received");
        }
    }
}
