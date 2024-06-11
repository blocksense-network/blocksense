use actix_web::rt::spawn;
use std::collections::HashMap;
use std::env;
use std::fmt::Debug;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio::time::Duration;
use tracing::{debug, error, info, info_span};

use crate::utils::time_utils::{get_ms_since_epoch, SlotTimeTracker};

pub struct VotesResultBatcher {}

impl VotesResultBatcher {
    pub fn new<
        K: Debug
            + Clone
            + std::string::ToString
            + 'static
            + std::cmp::Eq
            + PartialEq
            + std::hash::Hash,
        V: Debug + Clone + std::string::ToString + 'static,
    >(
        mut vote_recv: UnboundedReceiver<(K, V)>,
        batched_votes_send: UnboundedSender<HashMap<K, V>>,
    ) -> VotesResultBatcher {
        spawn(async move {
            let span = info_span!("VotesResultBatcher");
            let _guard = span.enter();
            let batch_size_env = "SEQUENCER_MAX_KEYS_TO_BATCH";
            let max_keys_to_batch = match env::var(batch_size_env) {
                Ok(batch_size) => batch_size
                    .parse::<usize>()
                    .expect(format!("{} should be an unsigned integer.", batch_size_env).as_str()),
                Err(_) => 1,
            };
            info!("max_keys_to_batch set to {}", max_keys_to_batch);
            let duration_env = "SEQUENCER_KEYS_BATCH_DURATION";
            let timeout_duration = match env::var(duration_env) {
                Ok(duration_env) => duration_env.parse::<u64>().expect(
                    format!(
                        "{} should be an unsigned integer in milliseconds.",
                        duration_env
                    )
                    .as_str(),
                ),
                Err(_) => 500,
            };
            info!("timeout_duration set to {}", timeout_duration);

            let mut stt = SlotTimeTracker::new(
                Duration::from_millis(timeout_duration),
                get_ms_since_epoch(),
            );

            loop {
                let mut updates: HashMap<K, V> = Default::default();
                let mut send_to_contract = false;
                while !send_to_contract {
                    let var: Result<Option<(K, V)>, tokio::time::error::Elapsed> =
                        actix_web::rt::time::timeout(
                            stt.get_duration_until_end_of_current_slot(),
                            vote_recv.recv(),
                        )
                        .await;
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
        });
        VotesResultBatcher {}
    }
}
