use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct BlocksenseConfig {
    /// List of all the oracle scripts
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub oracles: Vec<OracleScript>,
    /// List of all the capabilities scripts
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub capabilities: Vec<Capability>,
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
    pub data_feeds: Vec<DataFeed>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Capability {
    pub id: String,
}

// Function for calculating the result from the oracle script
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub enum OracleFunction {
    Median,
    #[default]
    Default,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct DataFeed {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    /// TODO(adikov): Initially data feeds would be executed in specified intervals
    pub interval: u64,
    #[serde(default)]
    pub function: OracleFunction,
}
