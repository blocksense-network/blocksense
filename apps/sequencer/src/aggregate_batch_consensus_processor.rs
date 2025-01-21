use actix_web::web::Data;
use config::BlockConfig;
use feed_registry::{registry::SlotTimeTracker, types::Repeatability};
use tracing::info;
use utils::time::{current_unix_time, system_time_to_millis};

use crate::sequencer_state::SequencerState;
use std::{io::Error, time::Duration};

pub async fn aggregation_batch_consensus_loop(
    sequencer_state: Data<SequencerState>,
    block_config: BlockConfig,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("aggregation_batch_consensus_loop")
        .spawn_local(async move {
            let block_genesis_time = match block_config.genesis_block_timestamp {
                Some(genesis_time) => system_time_to_millis(genesis_time),
                None => current_unix_time(),
            };

            let block_height_tracker = SlotTimeTracker::new(
                "aggregation_batch_consensus_loop".to_string(),
                Duration::from_millis(block_config.block_generation_period),
                block_genesis_time,
            );

            let timeout_period_blocks = block_config.aggregation_consensus_discard_period_blocks;

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

                let latest_block_height = block_height_tracker.get_last_slot();

                let mut batches_awaiting_consensus =
                    sequencer_state.batches_awaiting_consensus.lock().await;
                batches_awaiting_consensus
                    .clear_batches_older_than(latest_block_height as u64, timeout_period_blocks);
            }
        })
        .expect("Failed to spawn aggregation_batch_consensus_loop!")
}
