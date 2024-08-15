use std::convert::From;

use serde::{Deserialize, Serialize};
pub(crate) type Map<K, V> = indexmap::IndexMap<K, V>;

use crate::opts::{APP_NAME, AUTHOR, SEQUENCER_URL, SPIN_MANIFEST_VERSION, VERSION};
use blocksense_registry::config::{BlocksenseConfig, DataFeed, OracleScript};

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
        trigger_global_configs.insert(
            "settings".to_string(),
            toml::toml!(sequencer = SEQUENCER_URL),
        );

        let oracles = config
            .oracles
            .into_iter()
            .map(|oracle: OracleScript| {
                components.insert(
                    oracle.id.clone(),
                    Component {
                        source: ComponentSource::Local(oracle.oracle_script_wasm.clone()),
                    },
                );

                oracle
                    .data_feeds
                    .into_iter()
                    .map(|data_feed: DataFeed| -> Trigger {
                        let mut table = toml::Table::new();
                        table.insert("data_feed".to_string(), toml::Value::String(data_feed.id));
                        table.insert(
                            "interval_secs".to_string(),
                            toml::Value::Integer(data_feed.interval as i64),
                        );
                        Trigger {
                            component: oracle.id.clone(),
                            config: table,
                        }
                    })
                    .collect()
            })
            .collect::<Vec<Vec<Trigger>>>()
            .into_iter()
            .flatten()
            .collect();

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
  "oracles": [{
    "id": "revolut-example",
    "oracle_script_wasm": "revolut-example.wasm",
    "data_feeds": [{
        "id": "USD/BTC",
        "interval": 10
      }, {
        "id": "USD/ETH",
        "interval": 15
    }]
  }],
  "capabilities": []
}
    "#;
        let toml = r#"spin_manifest_version = 2

[application]
name = "Blocksense runtime"
version = "0.1.0"
authors = ["blocksense-network"]

[application.trigger.settings]
sequencer = "https://postman-echo.com/post"

[[trigger.oracle]]
component = "revolut-example"
data_feed = "USD/BTC"
interval_secs = 10

[[trigger.oracle]]
component = "revolut-example"
data_feed = "USD/ETH"
interval_secs = 15

[component.revolut-example]
source = "revolut-example.wasm"
"#;
        let config: BlocksenseConfig = serde_json::from_str(json).expect("Failed to parse json.");
        let spin_config = AppManifest::from(config);
        let toml_to_compare =
            toml::to_string_pretty(&spin_config).expect("Failed to serialize to toml.");
        assert_eq!(toml, toml_to_compare);
    }
}
