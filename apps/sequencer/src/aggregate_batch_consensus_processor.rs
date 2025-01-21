use actix_web::web::Data;
use config::BlockConfig;
use feed_registry::{registry::SlotTimeTracker, types::Repeatability};
use tokio::select;
use tokio::sync::mpsc::UnboundedReceiver;
use tracing::trace;
use utils::time::{current_unix_time, system_time_to_millis};

use crate::{sequencer_state::SequencerState, ReporterResponse};
use std::{io::Error, time::Duration};

pub async fn aggregation_batch_consensus_loop(
    sequencer_state: Data<SequencerState>,
    block_config: BlockConfig,
    mut aggregate_batch_sig_recv: UnboundedReceiver<ReporterResponse>,
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

            loop {
                select! {
                    _ = block_height_tracker.await_end_of_current_slot(&Repeatability::Periodic) => {

                        trace!("processing aggregation_batch_consensus_loop");

                        let latest_block_height = block_height_tracker.get_last_slot();

                        let mut batches_awaiting_consensus =
                            sequencer_state.batches_awaiting_consensus.write().await;
                        batches_awaiting_consensus
                            .clear_batches_older_than(latest_block_height as u64, timeout_period_blocks);
                    }
                    Some(signed_aggregate) = aggregate_batch_sig_recv.recv() => {

                        let mut batches_awaiting_consensus = sequencer_state
                            .batches_awaiting_consensus
                            .write()
                            .await;
                        batches_awaiting_consensus.insert_reporter_sig(&signed_aggregate);

                        //TODO: check if a quorum is reached, process the signatures and trigger send to contract
                    }
                }
            }
        })
        .expect("Failed to spawn aggregation_batch_consensus_loop!")
}
