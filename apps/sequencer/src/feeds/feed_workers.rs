use crate::feeds::feeds_slots_manager::feeds_slots_manager_loop;
use crate::feeds::feeds_state::FeedsState;
use crate::feeds::votes_result_batcher::votes_result_batcher_loop;
use crate::feeds::votes_result_sender::votes_result_sender_loop;
use crate::metrics_collector::metrics_collector_loop;
use actix_web::web::Data;
use config::SequencerConfig;
use futures_util::stream::FuturesUnordered;
use std::collections::HashMap;
use std::io::Error;
use tokio::sync::mpsc;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio::task::JoinHandle;

type BatchedVotesChannel = (
    UnboundedSender<HashMap<String, String>>,
    UnboundedReceiver<HashMap<String, String>>,
);
/// Given an app state and a sequencer configuration in launches the following app workers:
/// - Feeds slots manager loop
/// - Votes result batcher loop
/// - Votes result sender loop
/// - Metrics collector loop
pub async fn prepare_app_workers(
    app_state: Data<FeedsState>,
    sequencer_config: &SequencerConfig,
    voting_receive_channel: UnboundedReceiver<(String, String)>,
) -> FuturesUnordered<JoinHandle<Result<(), Error>>> {
    let (batched_votes_send, batched_votes_recv): BatchedVotesChannel = mpsc::unbounded_channel();

    let feeds_slots_manager_loop_fut =
        feeds_slots_manager_loop(app_state.clone(), app_state.voting_send_channel.clone()).await;

    let votes_batcher = votes_result_batcher_loop(
        // app_state.voting_recv_channel.clone(),
        voting_receive_channel,
        batched_votes_send,
        sequencer_config.max_keys_to_batch,
        sequencer_config.keys_batch_duration,
    )
    .await;

    let votes_sender =
        votes_result_sender_loop(batched_votes_recv, app_state.providers.clone()).await;

    let metrics_collector = metrics_collector_loop().await;

    let collected_futures: FuturesUnordered<JoinHandle<Result<(), Error>>> =
        FuturesUnordered::new();
    collected_futures.push(feeds_slots_manager_loop_fut);
    collected_futures.push(votes_batcher);
    collected_futures.push(votes_sender);
    collected_futures.push(metrics_collector);

    collected_futures
}
