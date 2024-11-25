use std::collections::HashMap;
use std::fmt::Debug;

pub mod blocks_reader;
pub mod feeds;
pub mod http_handlers;
pub mod metrics_collector;
pub mod providers;
pub mod reporters;
pub mod sequencer_state;
pub mod testing;

pub struct UpdateToSend<
    K: Debug + Clone + std::string::ToString + 'static,
    V: Debug + Clone + std::string::ToString + 'static,
> {
    pub block_height: u64,
    pub kv_updates: HashMap<K, V>,
}
