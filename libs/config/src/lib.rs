use hex::decode;
use serde::{de, Deserialize, Deserializer, Serialize};
use std::collections::HashSet;
use std::path::Path;
use std::time::SystemTime;
use std::{collections::HashMap, fmt::Debug};
use tracing::{info, trace};
use utils::constants::{
    FEEDS_CONFIG_DIR, FEEDS_CONFIG_FILE, SEQUENCER_CONFIG_DIR, SEQUENCER_CONFIG_FILE,
};
use utils::{get_config_file_path, read_file};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct AssetPair {
    pub base: String,
    pub quote: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct ChainlinkCompatibility {
    pub base: String,
    pub quote: String,
}

pub trait Validated {
    fn validate(&self, context: &str) -> anyhow::Result<()>;
}

/// Custom deserializator for the `resources` object in the FeedsConfig. Skips all non-string parsable items
fn deserialize_resources_as_string<'de, D>(
    deserializer: D,
) -> Result<HashMap<String, String>, D::Error>
where
    D: Deserializer<'de>,
{
    let raw_map: HashMap<String, serde_json::Value> = HashMap::deserialize(deserializer)?;

    let mut string_map: HashMap<String, String> = HashMap::new();

    for (key, value) in raw_map {
        // Convert each value to a String, regardless of its original type
        let value_as_string = match value {
            serde_json::Value::String(s) => s,
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            _ => {
                return Err(de::Error::custom(
                    "Expected string, number, or boolean for value",
                ))
            }
        };

        string_map.insert(key, value_as_string);
    }

    trace!("[FeedConfig] Resources: \n{:?}", string_map);

    Ok(string_map)
}

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
    #[serde(deserialize_with = "deserialize_resources_as_string")]
    pub resources: HashMap<String, String>, // TODO(snikolov): Find best way to handle various types of resource data
    pub quorum_percentage: f32, // The percentage of votes needed to aggregate and post result to contract.
    #[serde(default = "skip_publish_if_less_then_percentage_default")]
    pub skip_publish_if_less_then_percentage: f32,
    #[serde(default)]
    pub always_publish_heartbeat_ms: Option<u128>,
    pub script: String,
    pub value_type: String,
    pub aggregate_type: String,
}

fn skip_publish_if_less_then_percentage_default() -> f32 {
    0.0
}

impl FeedConfig {
    pub fn compare(left: &FeedConfig, right: &FeedConfig) -> std::cmp::Ordering {
        left.id.cmp(&right.id)
    }
}

impl Validated for FeedConfig {
    fn validate(&self, context: &str) -> anyhow::Result<()> {
        let range_percentage = 0.0f32..=100.0f32;
        if self.report_interval_ms == 0 {
            anyhow::bail!(
                "{}: report_interval_ms for feed {} with id {} cannot be set to 0",
                context,
                self.name,
                self.id
            );
        }
        if !range_percentage.contains(&self.quorum_percentage) {
            anyhow::bail!(
                "{}: quorum_percentage for feed {} with id {} must be between {} and {}",
                context,
                self.name,
                self.id,
                range_percentage.start(),
                range_percentage.end(),
            );
        }
        if !range_percentage.contains(&self.skip_publish_if_less_then_percentage) {
            anyhow::bail!(
            "{}: skip_publish_if_less_then_percentage for feed {} with id {} must be between {} and {}",
            context,
            self.name,
            self.id,
            range_percentage.start(),
            range_percentage.end(),
        );
        }
        if self.skip_publish_if_less_then_percentage > 0.0f32 {
            info!(
                "{}: Skipping updates in feed {} with id {} that deviate less then {} %",
                context, self.name, self.id, self.skip_publish_if_less_then_percentage,
            );
        }
        if let Some(value) = self.always_publish_heartbeat_ms {
            let max_always_publis_heartbeat_ms = 24 * 60 * 60 * 1000;
            if value > max_always_publis_heartbeat_ms {
                anyhow::bail!(
                    "{}: always_publish_heartbeat_ms for feed {} with id {} must be less then {} ms",
                    context,
                    self.name,
                    self.id,
                    max_always_publis_heartbeat_ms,
                );
            }
        };
        Ok(())
    }
}

#[derive(Debug, Deserialize, Serialize, PartialEq)]
pub struct AllFeedsConfig {
    pub feeds: Vec<FeedConfig>,
}

impl Validated for AllFeedsConfig {
    fn validate(&self, context: &str) -> anyhow::Result<()> {
        for feed in &self.feeds {
            feed.validate(context)?
        }

        Ok(())
    }
}

#[derive(Debug, Deserialize)]
pub struct ReporterConfig {
    pub full_batch: bool,
    pub batch_size: usize,
    pub sequencer_url: String,
    pub prometheus_url: String,
    pub poll_period_ms: u64, // TODO(snikolov): Move inside `Reporter` different poll periods are handled in reporter

    pub resources: HashMap<String, String>, // <`API`,`API_resource_dir`>
    pub reporter: Reporter,
}

impl Validated for ReporterConfig {
    fn validate(&self, _context: &str) -> anyhow::Result<()> {
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
// #[serde(rename_all = "PascalCase")]
pub struct Provider {
    pub private_key_path: String,
    pub url: String,
    pub contract_address: Option<String>,
    pub event_contract_address: Option<String>,
    pub transaction_timeout_secs: u32,
    pub transaction_gas_limit: u32,
    pub data_feed_store_byte_code: Option<String>,
    pub data_feed_sports_byte_code: Option<String>,
    pub impersonated_anvil_account: Option<String>,

    /// Whether data is written to the network (provider) or not. Useful for devops, if a single
    /// network is acting up and needs to be disabled without restarting the whole service.
    #[serde(default = "default_is_enabled")]
    pub is_enabled: bool,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_feeds: Option<Vec<u32>>,
}

fn default_is_enabled() -> bool {
    true
}

impl Validated for Provider {
    fn validate(&self, context: &str) -> anyhow::Result<()> {
        if self.transaction_timeout_secs == 0 {
            anyhow::bail!("{}: transaction_timeout_secs cannot be set to 0", context);
        }
        if self.transaction_gas_limit == 0 {
            anyhow::bail!("{}: transaction_gas_limit cannot be set to 0", context);
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Reporter {
    pub id: u32,
    pub pub_key: String,
}

impl Validated for Reporter {
    fn validate(&self, _context: &str) -> anyhow::Result<()> {
        if let Err(e) = decode(&self.pub_key) {
            anyhow::bail!(
                "Pub key of reporter id {} is not a valid hex string: {}",
                self.id,
                e
            );
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct BlockConfig {
    pub max_feed_updates_to_batch: usize,
    pub block_generation_period: u64,
    pub genesis_block_timestamp: Option<SystemTime>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct KafkaReportEndpoint {
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct SequencerConfig {
    pub main_port: u16,
    pub admin_port: u16,
    pub prometheus_port: u16,
    pub block_config: BlockConfig,
    pub providers: HashMap<String, Provider>,
    pub reporters: Vec<Reporter>,
    pub kafka_report_endpoint: KafkaReportEndpoint,
}

impl Validated for SequencerConfig {
    fn validate(&self, context: &str) -> anyhow::Result<()> {
        let ports = [self.main_port, self.admin_port, self.prometheus_port];
        let filtered_same_ports = HashSet::from(ports);
        if filtered_same_ports.len() != ports.len() {
            anyhow::bail!(
                "{}: main_port, admin_port or prometheus_port cannot be equal",
                context
            );
        }

        for (key, provider) in &self.providers {
            provider.validate(key.as_str())?
        }

        for reporter in &self.reporters {
            reporter.validate(format!("{}: Reporter id: {}", context, reporter.id).as_str())?
        }

        Ok(())
    }
}

pub fn init_config<T: for<'a> Deserialize<'a>>(config_file: &Path) -> anyhow::Result<T> {
    let config_file = match config_file.to_str() {
        Some(v) => v,
        None => anyhow::bail!("Error converting path to str, needed to read file."),
    };

    let data = read_file(config_file);

    info!("Using config file: {config_file}");

    serde_json::from_str::<T>(data.as_str())
        .map_err(|e| anyhow::anyhow!("Config file ({config_file}) is not valid JSON! {e}"))
}

pub fn get_validated_config<T: for<'a> Deserialize<'a> + Validated>(
    config_file: &Path,
) -> anyhow::Result<T> {
    let sequencer_config = match init_config::<T>(config_file) {
        Ok(v) => v,
        Err(e) => anyhow::bail!("Failed to get config {e} "),
    };

    match sequencer_config.validate("SequencerConfig") {
        Ok(_) => Ok(sequencer_config),
        Err(e) => anyhow::bail!("Validation error {e} "),
    }
}

pub fn get_sequencer_and_feed_configs() -> (SequencerConfig, AllFeedsConfig) {
    let sequencer_config_file = get_config_file_path(SEQUENCER_CONFIG_DIR, SEQUENCER_CONFIG_FILE);
    let sequencer_config = get_validated_config::<SequencerConfig>(&sequencer_config_file)
        .expect("Could not get validated sequencer config");
    let feeds_config_file = get_config_file_path(FEEDS_CONFIG_DIR, FEEDS_CONFIG_FILE);
    let feeds_config = get_validated_config::<AllFeedsConfig>(&feeds_config_file)
        .expect("Could not get validated feeds config");
    (sequencer_config, feeds_config)
}

// Utility functions for tests follow:

pub fn get_test_config_with_single_provider(
    network: &str,
    private_key_path: &Path,
    url: &str,
) -> SequencerConfig {
    SequencerConfig {
        main_port: 8877,
        admin_port: 5556,
        prometheus_port: 5555,
        block_config: BlockConfig{
            max_feed_updates_to_batch: 1,
            block_generation_period: 500,
            genesis_block_timestamp: None,
        },
        providers: HashMap::from([(
            network.to_string(),
            Provider {
                private_key_path: private_key_path.to_str().expect("Error in private key path").to_string(),
                url: url.to_string(),
                contract_address: None,
                event_contract_address: None,
                transaction_timeout_secs: 50,
                transaction_gas_limit: 7500000,
                data_feed_store_byte_code: Some("0x60a060405234801561001057600080fd5b503360805260805160e761002d60003960006045015260e76000f3fe6080604052348015600f57600080fd5b506000366060600060046000601c37506000516201ffff811015604357600f60fc1b6020526005601c205460005260206000f35b7f0000000000000000000000000000000000000000000000000000000000000000338114606f57600080fd5b631a2d80ac8281109083101760ac57600f60fc1b6004523660045b8181101560aa57600481600037600560002060048201359055602401608a565b005b600080fdfea264697066735822122015800ed562cf954d8d71346ded5d44d9d6c459e49b37d67049ba43a5524b430764736f6c63430008180033".to_string()),
                data_feed_sports_byte_code: Some("0x60a0604052348015600e575f80fd5b503373ffffffffffffffffffffffffffffffffffffffff1660808173ffffffffffffffffffffffffffffffffffffffff168152505060805161020e61005a5f395f60b1015261020e5ff3fe608060405234801561000f575f80fd5b5060045f601c375f5163800000008116156100ad5760043563800000001982166040517ff0000f000f00000000000000000000000000000000000000000000000000000081528160208201527ff0000f000f0000000000000001234000000000000000000000000000000000016040820152606081205f5b848110156100a5578082015460208202840152600181019050610087565b506020840282f35b505f7f000000000000000000000000000000000000000000000000000000000000000090503381146100dd575f80fd5b5f51631a2d80ac81036101d4576040513660045b818110156101d0577ff0000f000f0000000000000000000000000000000000000000000000000000008352600481603c8501377ff0000f000f000000000000000123400000000000000000000000000000000001604084015260608320600260048301607e86013760608401516006830192505f5b81811015610184576020810284013581840155600181019050610166565b50806020028301925060208360408701377fa826448a59c096f4c3cbad79d038bc4924494a46fc002d46861890ec5ac62df0604060208701a150506020810190506080830192506100f1565b5f80f35b5f80fdfea2646970667358221220b77f3ab2f01a4ba0833f1da56458253968f31db408e07a18abc96dd87a272d5964736f6c634300081a0033".to_string()),
                is_enabled: true,
                allow_feeds: None,
                impersonated_anvil_account: None,
            },
        )]),
        reporters: Vec::new(),
        kafka_report_endpoint: KafkaReportEndpoint{url: None},
    }
}

pub fn get_test_config_with_multiple_providers(
    provider_details: Vec<(&str, &Path, &str)>,
) -> SequencerConfig {
    let mut providers = HashMap::new();

    for (network, private_key_path, url) in provider_details {
        providers.insert(
            network.to_string(),
            Provider {
                private_key_path: private_key_path
                    .to_str()
                    .expect("Error in private_key_path: ")
                    .to_string(),
                url: url.to_string(),
                contract_address: None,
                event_contract_address: None,
                transaction_timeout_secs: 50,
                transaction_gas_limit: 7500000,
                data_feed_store_byte_code: Some("".to_string()),
                data_feed_sports_byte_code: Some("".to_string()),
                is_enabled: true,
                allow_feeds: None,
                impersonated_anvil_account: None,
            },
        );
    }

    SequencerConfig {
        main_port: 8877,
        admin_port: 5556,
        prometheus_port: 5555,
        block_config: BlockConfig {
            max_feed_updates_to_batch: 1,
            block_generation_period: 500,
            genesis_block_timestamp: None,
        },
        providers,
        reporters: Vec::new(),
        kafka_report_endpoint: KafkaReportEndpoint { url: None },
    }
}

#[cfg(test)]
mod tests {
    use utils::constants::{SEQUENCER_CONFIG_DIR, SEQUENCER_CONFIG_FILE};
    use utils::get_config_file_path;
    use utils::read_file;

    use super::*;
    use std::fs::File;
    use std::io::prelude::*;
    use std::path::PathBuf;

    #[test]
    fn sequencer_config_with_conflicting_ports_fails_validation() {
        let config_file_path = get_config_file_path(SEQUENCER_CONFIG_DIR, SEQUENCER_CONFIG_FILE);
        let config_file_path = config_file_path
            .to_str()
            .expect("Error converting path to str, needed to read file.");

        let data = read_file(config_file_path);
        let mut config_json = match serde_json::from_str::<SequencerConfig>(data.as_str()) {
            Ok(c) => c,
            Err(e) => panic!("Config file ({config_file_path}) is not valid JSON! {e}"),
        };
        config_json.main_port = config_json.admin_port; // Set an error in the config - endpoints cannot have same ports.

        let mut file = File::create("/tmp/sequencer_config.json")
            .expect("Could not create sequencer config file!");
        file.write(serde_json::to_string(&config_json).unwrap().as_bytes())
            .expect("Could not write to sequencer config file");
        file.flush().expect("Could flush sequencer config file");

        let path = PathBuf::new().join("/tmp").join("sequencer_config.json");
        match get_validated_config::<SequencerConfig>(&path) {
            Ok(_) => panic!("Did not detect error in config file!"),
            Err(_) => {}
        }
    }
}
