use actix_web::web::Data;
use feed_registry::{registry::SlotTimeTracker, types::Repeatability};
use tracing::info;
use utils::time::current_unix_time;

use crate::sequencer_state::SequencerState;
use std::{io::Error, time::Duration};

pub async fn aggregation_batch_consensus_loop(
    sequencer_state: Data<SequencerState>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("aggregation_batch_consensus_loop")
        .spawn_local(async move {
            let timeout_period_secs = 5 * 60; // TODO: take this timeouit from config
            let aggregation_batch_consensus_process_period = SlotTimeTracker::new(
                "aggregation_batch_consensus_loop".to_string(),
                Duration::from_secs(5),
                current_unix_time(),
            );

            loop {
                aggregation_batch_consensus_process_period
                    .await_end_of_current_slot(&Repeatability::Periodic)
                    .await;
                info!("processing!");

                let current_time_sec = current_unix_time() / 1000;

                let mut batches_awaiting_consensus =
                    sequencer_state.batches_awaiting_consensus.lock().await;
                batches_awaiting_consensus
                    .clear_batches_older_than(current_time_sec as u64, timeout_period_secs);
            }
        })
        .expect("Failed to spawn aggregation_batch_consensus_loop!")
}
