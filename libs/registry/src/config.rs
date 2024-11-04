use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::SystemTime;

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

pub fn get_blocksense_config_dummy() -> BlocksenseConfig {
    let oracle_scripts = vec![
        OracleScript {
            id: "oracle1".to_string(),
            name: Some("price_oracle".to_string()),
            description: Some("An oracle for fetching price data".to_string()),
            oracle_script_wasm: "local.wasm".to_string(),
            allowed_outbound_hosts: vec!["host1.com".to_string(), "host2.com".to_string()],
        },
        OracleScript {
            id: "oracle2".to_string(),
            name: None,
            description: None,
            oracle_script_wasm: "local.wasm".to_string(),
            allowed_outbound_hosts: vec!["host3.com".to_string()],
        },
    ];

    let capabilities = vec![
        Capability {
            id: "capability1".to_string(),
        },
        Capability {
            id: "capability2".to_string(),
        },
    ];

    let data_feeds = vec![FeedConfig {
        id: 1,
        name: "BTC/USD".to_string(),
        full_name: "BTC/USD".to_string(),
        description: "Feed for Bitcoin price in USD".to_string(),
        _type: "crypto".to_string(),
        decimals: 8,
        pair: AssetPair {
            base: "BTC".to_string(),
            quote: "USD".to_string(),
        },
        report_interval_ms: 60000,
        first_report_start_time: SystemTime::now(),
        resources: json!({"api_key": 0, "ticker": "BTC"}),
        quorum_percentage: 66.6,
        script: "price_oracle".to_string(),
    }];

    BlocksenseConfig {
        oracles: oracle_scripts,
        capabilities,
        data_feeds,
    }
}
