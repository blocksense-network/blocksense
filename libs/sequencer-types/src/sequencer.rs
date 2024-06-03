use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PostDataFeedPayload {
    /// reported id
    #[serde(default)]
    pub reporter_id: u64,
    /// data feed id
    #[serde(default)]
    pub feed_id: String,
    /// timestamp from when the data feed was gathered
    #[serde(default)]
    pub timestamp: u64,
    /// Data feed result
    #[serde(default)]
    pub result: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PostRegisterOracle {
    #[serde(default)]
    pub name: u64,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub data_feeds: Vec<DataFeed>,
    #[serde(default)]
    pub oracle_script_wasm: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct DataFeed {
    #[serde(default)]
    pub name: u64,
    #[serde(default)]
    pub namespace: u64,
}
