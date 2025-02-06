use crate::aggregate_batch_consensus_processor::aggregation_batch_consensus_loop;
use crate::block_creator::block_creator_loop;
use crate::blocks_reader::blocks_reader_loop;
use crate::feeds::feeds_slots_manager::feeds_slots_manager_loop;
use crate::feeds::votes_result_sender::votes_result_sender_loop;
use crate::metrics_collector::metrics_collector_loop;
use crate::sequencer_state::SequencerState;
use actix_web::web::Data;
use config::SequencerConfig;
use data_feeds::feeds_processing::VotedFeedUpdateWithProof;
use feed_registry::feed_registration_cmds::FeedsManagementCmds;
use futures_util::stream::FuturesUnordered;
use gnosis_safe::data_types::ReporterResponse;
use gnosis_safe::utils::SignatureWithAddress;
use std::io::Error;
use tokio::sync::mpsc;
use tokio::sync::mpsc::UnboundedReceiver;
use tokio::task::JoinHandle;

/// Given an app state and a sequencer configuration in launches the following app workers:
/// - Feeds slots manager loop
/// - Block creator loop
/// - Votes result sender loop
/// - Metrics collector loop
/// - Aggregation batch consensus loop
pub async fn prepare_app_workers(
    sequencer_state: Data<SequencerState>,
    sequencer_config: &SequencerConfig,
    aggregated_votes_to_block_creator_recv: UnboundedReceiver<VotedFeedUpdateWithProof>,
    feeds_management_cmd_to_block_creator_recv: UnboundedReceiver<FeedsManagementCmds>,
    feeds_slots_manager_cmd_recv: UnboundedReceiver<FeedsManagementCmds>,
    aggregate_batch_sig_recv: UnboundedReceiver<(ReporterResponse, SignatureWithAddress)>,
) -> FuturesUnordered<JoinHandle<Result<(), Error>>> {
    let (batched_votes_send, batched_votes_recv) = mpsc::unbounded_channel();

    let feeds_slots_manager_loop_fut =
        feeds_slots_manager_loop(sequencer_state.clone(), feeds_slots_manager_cmd_recv).await;

    let block_creator = block_creator_loop(
        // sequencer_state.voting_recv_channel.clone(),
        sequencer_state.clone(),
        aggregated_votes_to_block_creator_recv,
        feeds_management_cmd_to_block_creator_recv,
        batched_votes_send,
        sequencer_config.block_config.clone(),
    )
    .await;

    let votes_sender = votes_result_sender_loop(batched_votes_recv, sequencer_state.clone()).await;

    let metrics_collector = metrics_collector_loop().await;

    let blocks_reader = blocks_reader_loop(sequencer_state.clone()).await;

    let aggregation_batch_consensus = aggregation_batch_consensus_loop(
        sequencer_state,
        sequencer_config.block_config.clone(),
        aggregate_batch_sig_recv,
    )
    .await;

    let collected_futures: FuturesUnordered<JoinHandle<Result<(), Error>>> =
        FuturesUnordered::new();
    collected_futures.push(feeds_slots_manager_loop_fut);
    collected_futures.push(block_creator);
    collected_futures.push(votes_sender);
    collected_futures.push(metrics_collector);
    collected_futures.push(blocks_reader);
    collected_futures.push(aggregation_batch_consensus);

    collected_futures
}
