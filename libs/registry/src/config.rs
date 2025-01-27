use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct OraclesResponse {
    /// All registered oracles
    #[serde(default)]
    pub oracles: Vec<OracleScript>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct FeedsResponse {
    /// All registered data feeds
    #[serde(default)]
    pub feeds: Vec<FeedConfig>,
}

//TODO(melatron): This is duplicated from the config crate
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct AssetPair {
    pub base: String,
    pub quote: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct FeedQuorum {
    pub percentage: f32,
    pub aggregation: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct FeedSchedule {
    pub interval_ms: u64,
    pub heartbeat_ms: Option<u128>,
    pub deviation_percentage: f32,
    pub first_report_start_unix_time_ms: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct PriceFeedInfo {
    pub pair: AssetPair,
    pub decimals: u8,
    pub category: String,
    pub market_hours: Option<String>,
    pub arguments: serde_json::Value,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct CompatibilityInfo {
    pub chainlink: String,
}

//TODO(melatron): This is duplicated from the config crate
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct FeedConfig {
    pub id: u32,
    pub full_name: String,
    pub description: String,
    #[serde(rename = "type")] // rename because of reserved keyword
    pub feed_type: String,
    pub oracle_id: String,
    pub value_type: String,
    pub stride: u16,
    pub quorum: FeedQuorum,
    pub schedule: FeedSchedule,
    pub additional_feed_info: PriceFeedInfo,
    pub compatibility_info: Option<CompatibilityInfo>,
}

impl FeedConfig {
    pub fn compare(left: &FeedConfig, right: &FeedConfig) -> std::cmp::Ordering {
        left.id.cmp(&right.id)
    }
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ReporterInfo {
    /// Time interval in seconds of executing all oracles
    #[serde(default)]
    pub interval_time_in_seconds: u64,
    /// Sequencer URL
    #[serde(default)]
    pub sequencer: String,
    /// Kafka endpoint
    #[serde(default)]
    pub kafka_endpoint: String,
    /// Registry URL
    #[serde(default)]
    pub registry: String,
    /// Reporter secret key for signing transactions
    #[serde(default)]
    pub secret_key: String,
    /// Reporter id
    #[serde(default)]
    pub reporter_id: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct BlocksenseConfig {
    /// Information and data needed for the reporter
    #[serde(default)]
    pub reporter_info: ReporterInfo,
    /// List of all the oracle scripts
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub oracles: Vec<OracleScript>,
    /// List of all the capabilities scripts
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub capabilities: Vec<Capability>,
    /// List of all data feeds
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub data_feeds: Vec<FeedConfig>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OracleScript {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interval_time_in_seconds: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Description for the Oracle script.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// "local.wasm"
    #[serde(default)]
    pub oracle_script_wasm: String,
    /// Allowed hosts
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub allowed_outbound_hosts: Vec<String>,
    /// List of all the needed capabilities
    #[serde(default, skip_serializing_if = "HashSet::is_empty")]
    pub capabilities: HashSet<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Capability {
    pub id: String,
    pub data: String,
}
