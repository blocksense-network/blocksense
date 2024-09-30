#[derive(Clone, Debug)]
pub struct DataFeedSetting {
    pub id: String,
    pub data: String,
}

pub struct Settings {
    pub data_feeds: Vec<DataFeedSetting>,
}

impl Settings {
    pub fn new(data_feeds: Vec<DataFeedSetting>) -> Self {
        Self { data_feeds }
    }
}

//TODO(adikov): Start using FeedType from feed_registry
#[derive(Debug)]
pub struct DataFeedResult {
    pub id: String,
    pub value: f64,
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
