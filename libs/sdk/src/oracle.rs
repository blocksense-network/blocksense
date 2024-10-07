use serde::{Deserialize, Serialize};

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
}

impl Settings {
    pub fn new(data_feeds: Vec<DataFeedSetting>, capabilities: Vec<Capability>) -> Self {
        Self {
            data_feeds,
            capabilities,
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
