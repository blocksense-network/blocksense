//use std::collections::HashMap;

use data_feeds::feeds_processing::VotedFeedUpdate;

pub mod block_creator;
pub mod blocks_reader;
pub mod feeds;
pub mod http_handlers;
pub mod metrics_collector;
pub mod providers;
pub mod reporters;
pub mod sequencer_state;
pub mod testing;

pub struct UpdateToSend {
    pub block_height: u64,
    pub updates: Vec<VotedFeedUpdate>,
}
