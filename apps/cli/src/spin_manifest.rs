use std::convert::From;

use serde::{Deserialize, Serialize};

pub(crate) type Map<K, V> = indexmap::IndexMap<K, V>;

use crate::opts::{APP_NAME, AUTHOR, SPIN_MANIFEST_VERSION, VERSION};
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
    pub interval_time_in_seconds: u64,
    #[serde(flatten)]
    pub config: toml::Table,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Component {
    source: ComponentSource,
    allowed_outbound_hosts: Vec<String>,
    #[serde(default)]
    key_value_stores: Option<Vec<String>>,
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
        let mut table = toml::Table::new();
        table.insert(
            "interval_time_in_seconds".to_string(),
            toml::Value::Integer(config.reporter_info.interval_time_in_seconds as i64),
        );
        table.insert(
            "reporter_id".to_string(),
            toml::Value::Integer(config.reporter_info.reporter_id as i64),
        );
        table.insert(
            "sequencer".to_string(),
            toml::Value::String(config.reporter_info.sequencer),
        );

        if let Some(kafka_endpoint) = config.reporter_info.kafka_endpoint {
            table.insert("kafka_endpoint".into(), toml::Value::String(kafka_endpoint));
        }

        if let Some(second_consensus_secret_key) = config.reporter_info.second_consensus_secret_key
        {
            table.insert(
                "second_consensus_secret_key".into(),
                toml::Value::String(second_consensus_secret_key),
            );
        }

        table.insert(
            "secret_key".to_string(),
            toml::Value::String(config.reporter_info.secret_key),
        );
        trigger_global_configs.insert("settings".to_string(), table);

        let mut oracles: Vec<Trigger> = vec![];
        for oracle in config.oracles.iter() {
            let mut table = toml::Table::new();
            let mut feeds: Vec<toml::Value> = vec![];
            for data_feed in config.data_feeds.iter() {
                if data_feed.oracle_id != oracle.id {
                    continue;
                }

                let mut table = toml::Table::new();
                table.insert(
                    "id".to_string(),
                    toml::Value::String(data_feed.id.to_string()),
                );
                table.insert(
                    "stride".to_string(),
                    toml::Value::Integer(data_feed.stride as i64),
                );
                table.insert(
                    "decimals".to_string(),
                    toml::Value::Integer(data_feed.additional_feed_info.decimals as i64),
                );
                table.insert(
                    "data".to_string(),
                    toml::Value::String(
                        serde_json::to_string(&data_feed.additional_feed_info).unwrap(),
                    ),
                );
                feeds.push(toml::Value::Table(table));
            }
            table.insert("data_feeds".to_string(), toml::Value::Array(feeds));

            let mut capabilities: Vec<toml::Value> = vec![];
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
                interval_time_in_seconds: oracle
                    .interval_time_in_seconds
                    .unwrap_or(config.reporter_info.interval_time_in_seconds),
                config: table,
            });

            components.insert(
                oracle.id.clone(),
                Component {
                    source: ComponentSource::Local(oracle.oracle_script_wasm.clone()),
                    allowed_outbound_hosts: oracle.allowed_outbound_hosts.clone(),
                    key_value_stores: Some(vec!["default".into()]),
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

    // #[test]
    #[allow(dead_code)]
    fn serialize_to_spin_toml() {
        let json = r#"
{
  "reporter_info": {
    "interval_time_in_seconds": 10,
    "sequencer": "http://127.0.0.1:8546",
    "secret_key": "536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003",
    "reporter_id": 1
  },
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
  "data_feeds": [{
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
      "quorum_percentage": 100,
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
      "quorum_percentage": 100,
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
reporter_id = 1
sequencer = "http://127.0.0.1:8546"
secret_key = "536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003"

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
key_value_stores = ["default"]

[component.yahoo]
source = "yahoo_oracle.wasm"
allowed_outbound_hosts = ["https://yfapi.net:443"]
key_value_stores = ["default"]

[component.cmc]
source = "cmc_oracle.wasm"
allowed_outbound_hosts = ["https://pro-api.coinmarketcap.com"]
key_value_stores = ["default"]
"#;
        let config: BlocksenseConfig = serde_json::from_str(json).expect("Failed to parse json.");
        let toml_config: AppManifest = toml::from_str(toml).expect("Failed to parse toml.");
        let spin_config = AppManifest::from(config);
        let _toml_to_compare =
            toml::to_string_pretty(&spin_config).expect("Failed to serialize to toml.");
        let _compared_toml =
            toml::to_string_pretty(&toml_config).expect("Failed to serialize to toml.");
        //TODO(adikov): Fix test to work for the new config
        // assert_eq!(compared_toml, toml_to_compare);
    }
}
