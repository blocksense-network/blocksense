use std::convert::From;

use serde::{Deserialize, Serialize};

pub(crate) type Map<K, V> = indexmap::IndexMap<K, V>;

use crate::opts::{APP_NAME, AUTHOR, SEQUENCER_URL, SPIN_MANIFEST_VERSION, TIME_INTERVAL, VERSION};
use blocksense_registry::config::BlocksenseConfig;

//TODO(adikov): Transition to using - https://github.com/fermyon/spin/blob/main/crates/manifest/src/schema/v2.rs when
// we implement Serialize in our spin fork for the manifest crate.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AppManifest {
    spin_manifest_version: u64,
    application: AppDetails,
    #[serde(rename = "trigger")]
    triggers: Map<String, Vec<Trigger>>,
    #[serde(rename = "component")]
    components: Map<String, Component>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AppDetails {
    name: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    version: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    description: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    authors: Vec<String>,
    #[serde(rename = "trigger", default, skip_serializing_if = "Map::is_empty")]
    trigger_global_configs: Map<String, toml::Table>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Trigger {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub component: String,
    #[serde(flatten)]
    pub config: toml::Table,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Component {
    source: ComponentSource,
    allowed_outbound_hosts: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields, untagged)]
pub enum ComponentSource {
    /// `"local.wasm"`
    Local(String),
}

// TODO(adikov): Try using the Spin config toml from the spin repository.
impl From<BlocksenseConfig> for AppManifest {
    fn from(config: BlocksenseConfig) -> Self {
        let mut components: Map<String, Component> = Map::<String, Component>::new();
        let mut trigger_global_configs = Map::new();
        //TODO(adikov): Get all configuration from our blocksense config.
        let mut settings_table = toml::Table::new();
        settings_table.insert(
            "interval_time_in_seconds".to_string(),
            toml::Value::Integer(TIME_INTERVAL as i64),
        );
        settings_table.insert(
            "sequencer".to_string(),
            toml::Value::String(SEQUENCER_URL.to_string()),
        );
        settings_table.insert(
            "secret_key".to_string(),
            toml::Value::String(config.secret_key),
        );
        settings_table.insert(
            "reporter_id".to_string(),
            toml::Value::Integer(config.reporter_id as i64),
        );

        trigger_global_configs.insert("settings".to_string(), settings_table);

        let mut oracles: Vec<Trigger> = vec![];
        for oracle in config.oracles.iter() {
            let mut table = toml::Table::new();
            let mut feeds: Vec<toml::Value> = vec![];
            let mut capabilities: Vec<toml::Value> = vec![];
            for data_feed in config.data_feeds.iter() {
                if data_feed.script != oracle.id {
                    continue;
                }

                let mut table = toml::Table::new();
                table.insert(
                    "id".to_string(),
                    toml::Value::String(data_feed.id.to_string()),
                );
                table.insert(
                    "data".to_string(),
                    toml::Value::String(data_feed.resources.to_string()),
                );
                feeds.push(toml::Value::Table(table));
            }
            table.insert("data_feeds".to_string(), toml::Value::Array(feeds));

            for capability in config.capabilities.iter() {
                if !oracle.capabilities.contains(&capability.id) {
                    continue;
                }

                let mut table = toml::Table::new();
                table.insert(
                    "id".to_string(),
                    toml::Value::String(capability.id.to_string()),
                );
                table.insert(
                    "data".to_string(),
                    toml::Value::String(capability.data.to_string()),
                );
                capabilities.push(toml::Value::Table(table));
            }
            table.insert("capabilities".to_string(), toml::Value::Array(capabilities));

            oracles.push(Trigger {
                component: oracle.id.clone(),
                config: table,
            });

            components.insert(
                oracle.id.clone(),
                Component {
                    source: ComponentSource::Local(oracle.oracle_script_wasm.clone()),
                    allowed_outbound_hosts: oracle.allowed_outbound_hosts.clone(),
                },
            );
        }

        let mut triggers = Map::new();
        triggers.insert("oracle".to_string(), oracles);

        AppManifest {
            spin_manifest_version: SPIN_MANIFEST_VERSION,
            application: AppDetails {
                authors: vec![AUTHOR.to_string()],
                description: "".to_string(),
                name: APP_NAME.to_string(),
                version: VERSION.to_string(),
                trigger_global_configs,
            },
            triggers,
            components,
        }
    }
}

//TODO(adikov): Implement more tests for edge cases.
#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn serialize_to_spin_toml() {
        let json = r#"
{
  "reporterId": 10,
  "secretKey": "536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003",
  "oracles": [{
    "id": "revolut",
    "name": "Revolut",
    "oracle_script_wasm": "revolut_oracle.wasm",
    "allowed_outbound_hosts": ["https://pro-api.coinmarketcap.com"],
    "capabilities": []
  },{
    "id": "yahoo",
    "name": "yahoo",
    "oracle_script_wasm": "yahoo_oracle.wasm",
    "allowed_outbound_hosts": ["https://yfapi.net:443"],
    "capabilities": []
  },{
    "id": "cmc",
    "name": "cmc",
    "oracle_script_wasm": "cmc_oracle.wasm",
    "allowed_outbound_hosts": ["https://pro-api.coinmarketcap.com"],
    "capabilities": ["1"]
  }],
  "capabilities": [{
      "id": "1",
      "data": ""
  }],
  "dataFeeds": [{
      "id": 0,
      "name": "SAND",
      "fullName": "",
      "description": "SAND / USD",
      "type": "Crypto",
      "decimals": 8,
      "pair": {
        "base": "SAND",
        "quote": "USD"
      },
      "resources": {
        "cmc_id": 6210,
        "cmc_quote": "SAND"
      },
      "report_interval_ms": 300000,
      "first_report_start_time": {
        "secs_since_epoch": 0,
        "nanos_since_epoch": 0
      },
      "quorum_percentage": 1,
      "script": "cmc"
    },
    {
      "id": 1,
      "name": "AVAX",
      "fullName": "",
      "description": "AVAX / USD",
      "type": "Crypto",
      "decimals": 8,
      "pair": {
        "base": "AVAX",
        "quote": "USD"
      },
      "resources": {
        "cmc_id": 5805,
        "cmc_quote": "AVAX"
      },
      "report_interval_ms": 300000,
      "first_report_start_time": {
        "secs_since_epoch": 0,
        "nanos_since_epoch": 0
      },
      "quorum_percentage": 1,
      "script": "yahoo"
    }]
}
    "#;
        let toml = r#"spin_manifest_version = 2

[application]
name = "Blocksense runtime"
version = "0.1.0"
authors = ["blocksense-network"]

[application.trigger.settings]
interval_time_in_seconds = 10
sequencer = "http://gpu-server-001:8877/post_report"
secret_key = "536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003"
reporter_id = 10

[[trigger.oracle]]
component = "revolut"
data_feeds = []
capabilities = []

[[trigger.oracle]]
component = "yahoo"
capabilities = []

[[trigger.oracle.data_feeds]]
id = "1"
data = '{"cmc_id":5805,"cmc_quote":"AVAX"}'

[[trigger.oracle]]
component = "cmc"

[[trigger.oracle.data_feeds]]
id = "0"
data = '{"cmc_id":6210,"cmc_quote":"SAND"}'

[[trigger.oracle.capabilities]]
id = "1"
data = ""

[component.revolut]
source = "revolut_oracle.wasm"
allowed_outbound_hosts = ["https://pro-api.coinmarketcap.com"]

[component.yahoo]
source = "yahoo_oracle.wasm"
allowed_outbound_hosts = ["https://yfapi.net:443"]

[component.cmc]
source = "cmc_oracle.wasm"
allowed_outbound_hosts = ["https://pro-api.coinmarketcap.com"]
"#;
        let config: BlocksenseConfig = serde_json::from_str(json).expect("Failed to parse json.");
        let spin_config = AppManifest::from(config);
        let toml_to_compare =
            toml::to_string_pretty(&spin_config).expect("Failed to serialize to toml.");
        assert_eq!(toml, toml_to_compare);
    }
}
