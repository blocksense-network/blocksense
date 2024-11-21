use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::time::SystemTime;

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
//TODO(melatron): This is duplicated from the config crate
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct FeedConfig {
    pub id: u32,
    pub name: String,
    #[serde(rename = "fullName")] // rename for naming convention
    pub full_name: String,
    pub description: String,
    #[serde(rename = "type")] // rename because of reserved keyword
    pub _type: String,
    pub decimals: u8,
    pub pair: AssetPair,
    pub report_interval_ms: u64,
    pub first_report_start_time: SystemTime,
    pub resources: serde_json::Value,
    pub quorum_percentage: f32, // The percentage of votes needed to aggregate and post result to contract.
    pub script: String,
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
