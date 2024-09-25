use sequencer_config::FeedConfig;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct BlocksenseConfig {
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
    pub oracle_script_wasm: String,
    /// Allowed hosts
    pub allowed_outbound_hosts: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Capability {
    pub id: String,
}
