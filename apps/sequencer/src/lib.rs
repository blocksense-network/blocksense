//use std::collections::HashMap;

use data_feeds::feeds_processing::VotedFeedUpdate;

pub mod aggregate_batch_consensus_processor;
pub mod block_creator;
pub mod blocks_reader;
pub mod feeds;
pub mod http_handlers;
pub mod metrics_collector;
pub mod providers;
pub mod reporters;
pub mod sequencer_state;

use feed_registry::types::DataFeedPayload;
use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
pub struct UpdateToSend {
    pub block_height: u64,
    pub updates: Vec<VotedFeedUpdate>,
    // The key in this map is the feed id for which we provide a proof for the aggregated value.
    pub proofs: HashMap<u32, Vec<DataFeedPayload>>,
}
