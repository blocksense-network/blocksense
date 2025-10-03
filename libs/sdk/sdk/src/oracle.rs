use serde::{Deserialize, Serialize};

pub mod capabilities;
pub use capabilities::{get_api_keys, get_capabilities_from_settings, Capabilities};

#[derive(Clone, Debug)]
pub struct DataFeedSetting {
    pub id: String,
    pub data: String,
}

#[derive(Clone, Debug)]
pub struct Capability {
    pub id: String,
    pub data: String,
}

pub struct Settings {
    pub data_feeds: Vec<DataFeedSetting>,
    pub capabilities: Vec<Capability>,
    pub interval_time_in_seconds: u64,
}

impl Settings {
    pub fn new(
        data_feeds: Vec<DataFeedSetting>,
        capabilities: Vec<Capability>,
        interval_time_in_seconds: u64,
    ) -> Self {
        Self {
            data_feeds,
            capabilities,
            interval_time_in_seconds,
        }
    }
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub enum DataFeedResultValue {
    None,
    Numerical(f64),
    Text(String),
    Error(String),
}

//TODO(adikov): Start using FeedType from feed_registry
#[derive(Debug)]
pub struct DataFeedResult {
    pub id: String,
    pub value: DataFeedResultValue,
}

#[derive(Debug, Default)]
pub struct Payload {
    pub values: Vec<DataFeedResult>,
}

impl Payload {
    pub fn new() -> Self {
        Self { values: vec![] }
    }
}
