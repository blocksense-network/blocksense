use crate::feeds::block_creator::block_creator_loop;
use crate::feeds::feeds_slots_manager::feeds_slots_manager_loop;
use crate::feeds::votes_result_sender::votes_result_sender_loop;
use crate::metrics_collector::metrics_collector_loop;
use crate::sequencer_state::SequencerState;
use crate::UpdateToSend;
use actix_web::web::Data;
use config::SequencerConfig;
use feed_registry::feed_registration_cmds::FeedsManagementCmds;
use futures_util::stream::FuturesUnordered;
use std::io::Error;
use tokio::sync::mpsc;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio::task::JoinHandle;

type BatchedVotesChannel = (
    UnboundedSender<UpdateToSend<String, String>>,
    UnboundedReceiver<UpdateToSend<String, String>>,
);
/// Given an app state and a sequencer configuration in launches the following app workers:
/// - Feeds slots manager loop
/// - Votes result batcher loop
/// - Votes result sender loop
/// - Metrics collector loop
pub async fn prepare_app_workers(
    sequencer_state: Data<SequencerState>,
    sequencer_config: &SequencerConfig,
    voting_receive_channel: UnboundedReceiver<(String, String)>,
    feeds_slots_manager_cmd_recv: UnboundedReceiver<FeedsManagementCmds>,
) -> FuturesUnordered<JoinHandle<Result<(), Error>>> {
    let (batched_votes_send, batched_votes_recv): BatchedVotesChannel = mpsc::unbounded_channel();

    let feeds_slots_manager_loop_fut =
        feeds_slots_manager_loop(sequencer_state.clone(), feeds_slots_manager_cmd_recv).await;

    let votes_batcher = block_creator_loop(
        // sequencer_state.voting_recv_channel.clone(),
        voting_receive_channel,
        batched_votes_send,
        sequencer_config.max_keys_to_batch,
        sequencer_config.keys_batch_duration,
        sequencer_state.blockchain_db.clone(),
    )
    .await;

    let votes_sender = votes_result_sender_loop(batched_votes_recv, sequencer_state).await;

    let metrics_collector = metrics_collector_loop().await;

    let collected_futures: FuturesUnordered<JoinHandle<Result<(), Error>>> =
        FuturesUnordered::new();
    collected_futures.push(feeds_slots_manager_loop_fut);
    collected_futures.push(votes_batcher);
    collected_futures.push(votes_sender);
    collected_futures.push(metrics_collector);

    collected_futures
}
