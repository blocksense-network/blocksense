//use std::collections::HashMap;

use data_feeds::feeds_processing::VotedFeedUpdate;
use serde::{Deserialize, Serialize};

pub mod aggregate_batch_consensus_processor;
pub mod block_creator;
pub mod blocks_reader;
pub mod feeds;
pub mod http_handlers;
pub mod metrics_collector;
pub mod providers;
pub mod reporters;
pub mod sequencer_state;

#[derive(Debug, Clone, Default)]
pub struct UpdateToSend {
    pub block_height: u64,
    pub updates: Vec<VotedFeedUpdate>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ConsensusSecondRoundBatch {
    sequencer_id: u64,
    block_height: u64,
    network: String,
    calldata: String,
}
