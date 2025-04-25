use std::collections::HashMap;

use blocksense_config::FeedStrideAndDecimals;
use tokio::{sync::mpsc::unbounded_channel, task::JoinHandle};
use url::Url;

use crate::{DataFeedResults, TerminationReason};

mod listener;
mod processor;

pub fn start_second_consensus_tasks(
    reporter_id: u64,
    kafka_endpoint: String,
    sequencer_url: &Url,
    second_consensus_secret_key: String,
    feeds_config: HashMap<u32, FeedStrideAndDecimals>,
    latest_votes: DataFeedResults,
) -> anyhow::Result<Vec<JoinHandle<TerminationReason>>> {
    let (aggregated_consensus_sender, aggregated_consensus_receiver) = unbounded_channel();

    let listener = self::listener::listen(kafka_endpoint, aggregated_consensus_sender);

    let processor = self::processor::process(
        aggregated_consensus_receiver,
        feeds_config,
        latest_votes,
        sequencer_url.join("/post_aggregated_consensus_vote")?,
        second_consensus_secret_key,
        reporter_id,
    );

    Ok(vec![tokio::spawn(listener), tokio::spawn(processor)])
}
