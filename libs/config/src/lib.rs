use blocksense_registry::config::{
    CompatibilityInfo, FeedConfig, FeedQuorum, FeedSchedule, PriceFeedInfo,
};
use blocksense_utils::constants::{
    FEEDS_CONFIG_DIR, FEEDS_CONFIG_FILE, SEQUENCER_CONFIG_DIR, SEQUENCER_CONFIG_FILE,
};
use blocksense_utils::{get_config_file_path, read_file, FeedId};
use hex::decode;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::SystemTime;
use std::{collections::HashMap, fmt::Debug};
use std::{collections::HashSet, time::UNIX_EPOCH};
use tracing::{info, warn};

pub const ADFS_CONTRACT_NAME: &str = "AggregatedDataFeedStore";
pub const ADFS_ACCESS_CONTROL_CONTRACT_NAME: &str = "ADFSAccessControl";
pub const GNOSIS_SAFE_CONTRACT_NAME: &str = "gnosis_safe";

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

impl Validated for FeedConfig {
    fn validate(&self, context: &str) -> anyhow::Result<()> {
        let range_percentage = 0.0f32..=100.0f32;
        if self.schedule.interval_ms == 0 {
            anyhow::bail!(
                "{}: report_interval_ms for feed {} with id {} cannot be set to 0",
                context,
                self.full_name,
                self.id
            );
        }

        if !range_percentage.contains(&self.quorum.percentage) {
            anyhow::bail!(
                "{}: quorum_percentage for feed {} with id {} must be between {} and {}",
                context,
                self.full_name,
                self.id,
                range_percentage.start(),
                range_percentage.end(),
            );
        }

        if !range_percentage.contains(&self.schedule.deviation_percentage) {
            anyhow::bail!(
            "{}: skip_publish_if_less_then_percentage for feed {} with id {} must be between {} and {}",
            context,
            self.full_name,
            self.id,
            range_percentage.start(),
            range_percentage.end(),
        );
        }

        if self.schedule.deviation_percentage > 0.0f32 {
            info!(
                "{}: Skipping updates in feed {} with id {} that deviate less then {} %",
                context, self.full_name, self.id, self.schedule.deviation_percentage,
            );
        }

        if let Some(value) = self.schedule.heartbeat_ms {
            let max_always_publis_heartbeat_ms = 24 * 60 * 60 * 1000;
            if value > max_always_publis_heartbeat_ms {
                anyhow::bail!(
                    "{}: always_publish_heartbeat_ms for feed {} with id {} must be less then {} ms",
                    context,
                    self.full_name,
                    self.id,
                    max_always_publis_heartbeat_ms,
                );
            }
        };
        Ok(())
    }
}

#[derive(Clone, Debug)]
pub struct FeedStrideAndDecimals {
    pub stride: u8,
    pub decimals: u8,
}

impl FeedStrideAndDecimals {
    pub fn from_feed_config(feed_config: &Option<FeedConfig>) -> FeedStrideAndDecimals {
        let stride = match &feed_config {
            Some(f) => f.stride,
            None => {
                warn!("Propagating result for unregistered feed! Support left for legacy one shot feeds of 32 bytes size.");
                0
            }
        };

        let decimals = match &feed_config {
            Some(f) => f.additional_feed_info.decimals,
            None => {
                warn!("Propagating result for unregistered feed! Support left for legacy one shot feeds of 32 bytes size. Decimal default to 18");
                18
            }
        };

        FeedStrideAndDecimals { stride, decimals }
    }
}

#[derive(Debug, Deserialize, Serialize, PartialEq, Clone)]
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
    pub metrics_url: String,
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
pub struct PublishCriteria {
    pub feed_id: FeedId,
    #[serde(default)]
    pub skip_publish_if_less_then_percentage: f64,

    pub always_publish_heartbeat_ms: Option<u128>,
    #[serde(default)]
    pub peg_to_value: Option<f64>,
    #[serde(default)]
    pub peg_tolerance_percentage: f64,
}

impl PublishCriteria {
    pub fn should_peg(&self, value: f64) -> bool {
        self.peg_to_value.is_some_and(|peg_value| {
            let tolerance = peg_value * self.peg_tolerance_percentage * 0.01f64;
            let peg_range = (peg_value - tolerance)..(peg_value + tolerance);
            peg_range.contains(&value)
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct ContractConfig {
    pub name: String,
    pub address: Option<String>,
    #[serde(alias = "byte_code")]
    pub creation_byte_code: Option<String>,
    pub deployed_byte_code: Option<String>,
    #[serde(default)]
    pub min_quorum: Option<u32>,
    pub contract_version: u16,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
// #[serde(rename_all = "PascalCase")]
pub struct Provider {
    pub private_key_path: String,
    pub url: String,
    pub transaction_retries_count_before_give_up: u32,
    pub transaction_retry_timeout_secs: u32,
    pub retry_fee_increment_fraction: f64,
    pub transaction_gas_limit: u32,
    pub impersonated_anvil_account: Option<String>,

    /// Whether data is written to the network (provider) or not. Useful for devops, if a single
    /// network is acting up and needs to be disabled without restarting the whole service.
    #[serde(default = "default_is_enabled")]
    pub is_enabled: bool,

    #[serde(default = "default_is_enabled")]
    pub should_load_round_counters: bool,

    #[serde(default = "default_is_enabled")]
    pub should_load_historical_values: bool,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_feeds: Option<Vec<FeedId>>,

    #[serde(default)]
    pub publishing_criteria: Vec<PublishCriteria>,

    #[serde(default)]
    pub contracts: Vec<ContractConfig>,
}

fn default_is_enabled() -> bool {
    true
}

impl Validated for Provider {
    fn validate(&self, context: &str) -> anyhow::Result<()> {
        if self.transaction_retry_timeout_secs == 0 {
            anyhow::bail!(
                "{}: transaction_retry_timeout_secs cannot be set to 0",
                context
            );
        }
        if self.transaction_gas_limit == 0 {
            anyhow::bail!("{}: transaction_gas_limit cannot be set to 0", context);
        }
        Ok(())
    }
}

impl Provider {
    pub fn get_contract_config(&self, name: &str) -> Option<&ContractConfig> {
        self.contracts.iter().find(|c| c.name == name)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Reporter {
    pub id: u32,
    pub pub_key: String,
    pub address: String,
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
    pub genesis_block_timestamp_ms: Option<u128>,
    pub aggregation_consensus_discard_period_blocks: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct KafkaReportEndpoint {
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct PyroscopeConfig {
    pub user: Option<String>,
    pub password_file_path: Option<String>,
    pub url: String,
    pub sample_rate: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct SequencerConfig {
    pub sequencer_id: u64,
    pub main_port: u16,
    pub admin_port: u16,
    pub prometheus_port: u16,
    pub block_config: BlockConfig,
    pub providers: HashMap<String, Provider>,
    pub reporters: Vec<Reporter>,
    pub kafka_report_endpoint: KafkaReportEndpoint,
    pub http_input_buffer_size: Option<usize>,
    pub pyroscope_config: Option<PyroscopeConfig>,
    #[serde(default = "default_is_enabled")]
    pub send_aggregated_updates_to_publishers: bool,
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

impl SequencerConfig {
    pub fn should_load_historical_values(&self, network: &str) -> bool {
        if let Some(p) = self.providers.get(network) {
            p.should_load_historical_values
        } else {
            false
        }
    }

    pub fn should_load_round_counters(&self, network: &str) -> bool {
        if let Some(p) = self.providers.get(network) {
            p.should_load_round_counters
        } else {
            false
        }
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
    context: &str,
) -> anyhow::Result<T> {
    let config = match init_config::<T>(config_file) {
        Ok(v) => v,
        Err(e) => anyhow::bail!("Failed to get config {e} "),
    };

    match config.validate(context) {
        Ok(_) => Ok(config),
        Err(e) => anyhow::bail!("Validation error {e} "),
    }
}

pub fn get_sequencer_config() -> SequencerConfig {
    let sequencer_config_file = get_config_file_path(SEQUENCER_CONFIG_DIR, SEQUENCER_CONFIG_FILE);
    get_validated_config::<SequencerConfig>(&sequencer_config_file, "SequencerConfig")
        .expect("Could not get validated sequencer config")
}

pub fn get_feeds_config() -> AllFeedsConfig {
    let feeds_config_file = get_config_file_path(FEEDS_CONFIG_DIR, FEEDS_CONFIG_FILE);
    get_validated_config::<AllFeedsConfig>(&feeds_config_file, "FeedsConfig")
        .expect("Could not get validated feeds config")
}

pub fn get_sequencer_and_feed_configs() -> (SequencerConfig, AllFeedsConfig) {
    (get_sequencer_config(), get_feeds_config())
}

// Utility functions for tests follow:

pub fn test_feed_config(id: FeedId, stride: u8) -> FeedConfig {
    FeedConfig {
        id,
        full_name: "FOXY".to_owned(),
        description: "FOXY / USD".to_owned(),
        feed_type: "price-feed".to_owned(),
        oracle_id: "cex-price-feeds".to_owned(),
        value_type: "numerical".to_owned(),
        stride,
        quorum: FeedQuorum {
            percentage: 100.0,
            aggregation: "median".to_owned(),
        },
        schedule: FeedSchedule {
            interval_ms: 90000,
            heartbeat_ms: Some(3600000),
            deviation_percentage: 0.1,
            first_report_start_unix_time_ms: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        },
        additional_feed_info: PriceFeedInfo {
            pair: blocksense_registry::config::AssetPair {
                base: "FOXY".to_owned(),
                quote: "USD".to_owned(),
            },
            decimals: 18,
            category: "Crypto".to_owned(),
            market_hours: Some("Crypto".to_owned()),
            arguments: serde_json::from_str(
                r#"
                {
                    "aggregators": {
                        "CoinMarketCap": {
                          "symbol": [
                            "weETH"
                          ],
                          "id": [
                            28695
                          ]
                        }
                      }
                }"#,
            )
            .unwrap(),
        },
        compatibility_info: Some(CompatibilityInfo {
            chainlink: "weETH / ETH".to_owned(),
        }),
    }
}

pub fn test_feeds_config(id: FeedId, stride: u8) -> HashMap<FeedId, FeedConfig> {
    let mut feeds_config = HashMap::new();
    feeds_config.insert(id, test_feed_config(id, stride));
    feeds_config
}

pub fn test_data_feed_store_byte_code() -> String {
    "0x60a060405234801561001057600080fd5b506040516101cf3803806101cf83398101604081905261002f91610040565b6001600160a01b0316608052610070565b60006020828403121561005257600080fd5b81516001600160a01b038116811461006957600080fd5b9392505050565b60805161014561008a6000396000609001526101456000f3fe608060405234801561001057600080fd5b50600060405160046000601c83013751905063e000000081161561008e5763e0000000198116632000000082161561005957806020526004356004603c20015460005260206000f35b805463800000008316156100775781600052806004601c2001546000525b634000000083161561008857806020525b60406000f35b7f00000000000000000000000000000000000000000000000000000000000000003381146100bb57600080fd5b631a2d80ac820361010a57423660045b8181101561010857600481601c376000516004601c2061ffff6001835408806100f2575060015b91829055600483013585179101556024016100cb565b005b600080fdfea26469706673582212204a7c38e6d9b723ea65e6d451d6a8436444c333499ad610af033e7360a2558aea64736f6c63430008180033".to_string()
}

pub fn test_data_feed_sports_byte_code() -> String {
    "0x60a0604052348015600e575f80fd5b503373ffffffffffffffffffffffffffffffffffffffff1660808173ffffffffffffffffffffffffffffffffffffffff168152505060805161020e61005a5f395f60b1015261020e5ff3fe608060405234801561000f575f80fd5b5060045f601c375f5163800000008116156100ad5760043563800000001982166040517ff0000f000f00000000000000000000000000000000000000000000000000000081528160208201527ff0000f000f0000000000000001234000000000000000000000000000000000016040820152606081205f5b848110156100a5578082015460208202840152600181019050610087565b506020840282f35b505f7f000000000000000000000000000000000000000000000000000000000000000090503381146100dd575f80fd5b5f51631a2d80ac81036101d4576040513660045b818110156101d0577ff0000f000f0000000000000000000000000000000000000000000000000000008352600481603c8501377ff0000f000f000000000000000123400000000000000000000000000000000001604084015260608320600260048301607e86013760608401516006830192505f5b81811015610184576020810284013581840155600181019050610166565b50806020028301925060208360408701377fa826448a59c096f4c3cbad79d038bc4924494a46fc002d46861890ec5ac62df0604060208701a150506020810190506080830192506100f1565b5f80f35b5f80fdfea2646970667358221220b77f3ab2f01a4ba0833f1da56458253968f31db408e07a18abc96dd87a272d5964736f6c634300081a0033".to_string()
}

pub fn get_test_config_with_single_provider(
    network: &str,
    private_key_path: &Path,
    url: &str,
) -> SequencerConfig {
    get_test_config_with_multiple_providers(vec![(network, private_key_path, url)])
}

pub fn get_test_config_with_no_providers() -> SequencerConfig {
    SequencerConfig {
        sequencer_id: 1,
        main_port: 8877,
        admin_port: 5556,
        prometheus_port: 5555,
        block_config: BlockConfig {
            max_feed_updates_to_batch: 1,
            block_generation_period: 500,
            genesis_block_timestamp_ms: None,
            aggregation_consensus_discard_period_blocks: 100,
        },
        providers: HashMap::new(),
        reporters: Vec::new(),
        kafka_report_endpoint: KafkaReportEndpoint { url: None },
        http_input_buffer_size: None,
        pyroscope_config: None,
        send_aggregated_updates_to_publishers: false,
    }
}

pub fn get_test_config_with_multiple_providers(
    provider_details: Vec<(&str, &Path, &str)>,
) -> SequencerConfig {
    let mut sequencer_config = get_test_config_with_no_providers();
    for (network, private_key_path, url) in provider_details {
        sequencer_config.providers.insert(
            network.to_string(),
            Provider {
                private_key_path: private_key_path
                    .to_str()
                    .expect("Error in private_key_path: ")
                    .to_string(),
                url: url.to_string(),
                transaction_retries_count_before_give_up: 10,
                transaction_retry_timeout_secs: 24,
                retry_fee_increment_fraction: 0.1,
                transaction_gas_limit: 7500000,
                is_enabled: true,
                should_load_round_counters: false,
                should_load_historical_values: false,
                allow_feeds: None,
                publishing_criteria: vec![],
                impersonated_anvil_account: None,
                contracts: vec![
                    // Gnosis safe contract, if present changes the flow, and no direct updates will be made to the ADFS contract.
                    // TODO: In the future when tests for Gnosis safe are added this contract will have to be manually added to the provider configured fro two phase consensus
                    /*ContractConfig {
                        name: GNOSIS_SAFE_CONTRACT_NAME.to_string(),
                        address: Some("0x7f09E80DA1dFF8df7F1513E99a3458b228b9e19C".to_string()),
                        creation_byte_code: None,
                        deployed_byte_code: None,
                        contract_version: 1,
                    },*/
                    ContractConfig {
                        name: ADFS_CONTRACT_NAME.to_string(),
                        address: None,
                        creation_byte_code: Some("0x60a0604052348015600f57600080fd5b506040516104a23803806104a2833981016040819052602c91603c565b6001600160a01b0316608052606a565b600060208284031215604d57600080fd5b81516001600160a01b0381168114606357600080fd5b9392505050565b60805161041d610085600039600061020d015261041d6000f3fe6080604052600035600160ff1b811615610201578060011a8160101b60881c601f82116e07ffffffffffffffffffffffffffff8211171561003f57600080fd5b6011358360f81c93506086840361010b576001831b8160f01c611fff81111561006757600080fd5b841b600d84901b851b0160133611156100bc5763ffffffff60b084901c8116925060d084901c160160018401600d1b851b60001901826100a8576001861b92505b8060018403830111156100ba57600080fd5b505b80600160801b861b019050600060405183600181146100fc5760005b858110156100f65784810154838501526020909301926001016100d8565b50508181f35b83548383015260209250508181f35b600f821660041b6001600160f01b0319811c838560731b0160041c610fff60741b0154168160f0031c90506000604051600187161561014c57602091508281525b600287161561017057600160801b861b600d86901b84010154818301526020820181f35b60048716156101fd576001861b83871b86600d1b881b0160133611156101d05763ffffffff60c087901c16915060e086901c0160001960018801600d1b891b01826101bc576001891b92505b8060018403830111156101ce57600080fd5b505b600160801b881b0160005b828110156101f95781810154848601526020909401936001016101db565b5050505b8181f35b506040513360601b81527f000000000000000000000000000000000000000000000000000000000000000090602081601481855afa8151811661024357600080fd5b50600081525060003560018160001a036103e2578060081b60c01c60005460008183110361027057600080fd5b5080600055368260481b60e01c600d60005b8281101561035e5781358060001a601f81111561029e57600080fd5b600160801b811b8260011a8060031b8460101b81610100031c85836002011a86836018011b8160031b610100031c965080840160030189019850508560051c9250601f86169550600184600160801b600188011b03036001600088118501038201111561030a57600080fd5b600094505b8285101561033057873585820185015560018501945060208801975061030f565b851561034d5787358660031b610100031c83820185015585880197505b505050505050600181019050610282565b505b828110156103b257803591508160001a8260081b8160031b610100031c92506e0fffffffffffffffffffffffffffff83111561039b57600080fd5b016001810135610fff60741b830155602101610360565b50505080600052507fe64378c8d8a289137204264780c7669f3860a703795c6f0574d925d473a4a2a760206000a1005b600080fdfea2646970667358221220e8068dbe395db7fb6a5aae9a33faf6c8f50c1363a8668f99a6f96c132303734264736f6c634300081c0033".to_string()),
                        deployed_byte_code: None,
                        contract_version: 2,
                        min_quorum: None,
                    },
                    ContractConfig {
                        name: ADFS_ACCESS_CONTROL_CONTRACT_NAME.to_string(),
                        address: None,
                        creation_byte_code: Some("0x60a0604052348015600f57600080fd5b5060405161012c38038061012c833981016040819052602c91603c565b6001600160a01b0316608052606a565b600060208284031215604d57600080fd5b81516001600160a01b0381168114606357600080fd5b9392505050565b60805160aa61008260003960006012015260aa6000f3fe6080604052348015600f57600080fd5b507f0000000000000000000000000000000000000000000000000000000000000000338181036065573660005b818110156063578035601481901a6bffffffffffffffffffffffff1990911655601501603c565b005b50600035805460005260206000f3fea264697066735822122027946863766b970abf88d8835d243175f1a5efecf5c3a26e02de48df592a4b9064736f6c634300081c0033".to_string()),
                        deployed_byte_code: None,
                        contract_version: 1,
                        min_quorum: None,
                    }
                ],
            },
        );
    }
    sequencer_config
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sequencer_config_with_conflicting_ports_fails_validation() {
        let sequencer_config = get_test_config_with_no_providers();

        let mut invalid_config_1 = sequencer_config.clone();
        invalid_config_1.admin_port = invalid_config_1.main_port;

        let mut invalid_config_2 = sequencer_config.clone();
        invalid_config_2.prometheus_port = invalid_config_2.main_port;

        let mut invalid_config_3 = sequencer_config.clone();
        invalid_config_3.prometheus_port = invalid_config_3.admin_port;

        assert!(sequencer_config.validate("").is_ok());
        assert!(invalid_config_1.validate("").is_err());
        assert!(invalid_config_2.validate("").is_err());
        assert!(invalid_config_3.validate("").is_err());
    }

    #[test]
    fn parsing_provider_config_with_publish_criteria() {
        // let p: Provider = serde_json::from_str(r#"
        //     {
        //     "private_key_path": "/tmp/priv_key_test",
        //     "url": "http://127.0.0.1:8546",
        //     "transaction_retries_count_before_give_up": 42,
        //     "transaction_retry_timeout_secs": 20,
        //     "retry_fee_increment_fraction": 0.1,
        //     "transaction_gas_limit": 7500000,
        //     "safe_min_quorum": 1,
        //     "publishing_criteria": [
        //         {
        //             "feed_id": 13,
        //             "skip_publish_if_less_then_percentage": 13.2,
        //             "always_publish_heartbeat_ms": 50000
        //         },
        //         {
        //             "feed_id": 15,
        //             "skip_publish_if_less_then_percentage": 2.2
        //         },
        //         {
        //             "feed_id": 8,
        //             "always_publish_heartbeat_ms": 12345
        //         },
        //         {
        //             "feed_id": 2
        //         },
        //         {
        //             "feed_id": 22,
        //             "peg_to_value": 1.995
        //         },
        //         {
        //             "feed_id": 23,
        //             "peg_to_value": 1.00,
        //             "peg_tolerance_percentage": 1.3
        //         },
        //         {
        //             "feed_id": 24,
        //             "peg_tolerance_percentage": 4.3
        //         },
        //         {
        //             "feed_id": 25,
        //             "skip_publish_if_less_then_percentage": 1.32,
        //             "always_publish_heartbeat_ms": 45000,
        //             "peg_to_value": 5.00,
        //             "peg_tolerance_percentage": 1.3
        //         }
        //     ],
        //     "contracts": [
        //     ]
        //     }"#).unwrap();
        // assert!(p.is_enabled);
        // assert_eq!(&p.private_key_path, "/tmp/priv_key_test");
        // assert_eq!(&p.url, "http://127.0.0.1:8546");
        // assert_eq!(p.transaction_retries_count_before_give_up, 42_u32);
        // assert_eq!(p.transaction_retry_timeout_secs, 20_u32);
        // assert_eq!(p.retry_fee_increment_fraction, 0.1f64);
        // assert_eq!(p.transaction_gas_limit, 7500000_u32);

        // let sports_contract_config = p
        //     .get_contract_config(SPORTS_DATA_FEED_STORE_V2_CONTRACT_NAME)
        //     .unwrap();
        // assert_eq!(
        //     sports_contract_config.name,
        //     SPORTS_DATA_FEED_STORE_V2_CONTRACT_NAME
        // );
        // assert_eq!(sports_contract_config.address, None);
        // assert_eq!(
        //     sports_contract_config
        //         .creation_byte_code
        //         .clone()
        //         .map(|x| x.len()),
        //     Some(1234)
        // );
        // assert_eq!(sports_contract_config.contract_version, 1);

        // assert_eq!(p.allow_feeds, None);
        // assert_eq!(p.publishing_criteria.len(), 8);
        // assert_eq!(p.impersonated_anvil_account, None);

        // {
        //     let c = &p.publishing_criteria[0];
        //     assert_eq!(c.feed_id, 13);
        //     assert_eq!(c.skip_publish_if_less_then_percentage, 13.2f64);
        //     assert_eq!(c.always_publish_heartbeat_ms, Some(50_000));
        //     assert_eq!(p.publishing_criteria[0].peg_to_value, None);
        //     assert_eq!(p.publishing_criteria[0].peg_tolerance_percentage, 0.0f64);
        // }

        // {
        //     let c = &p.publishing_criteria[1];
        //     assert_eq!(c.feed_id, 15);
        //     assert_eq!(c.skip_publish_if_less_then_percentage, 2.2f64);
        //     assert_eq!(c.always_publish_heartbeat_ms, None);
        //     assert_eq!(c.peg_to_value, None);
        //     assert_eq!(c.peg_tolerance_percentage, 0.0f64);
        // }
        // {
        //     let c = &p.publishing_criteria[2];
        //     assert_eq!(c.feed_id, 8);
        //     assert_eq!(c.skip_publish_if_less_then_percentage, 0.0f64);
        //     assert_eq!(c.always_publish_heartbeat_ms, Some(12_345));
        //     assert_eq!(c.peg_to_value, None);
        //     assert_eq!(c.peg_tolerance_percentage, 0.0f64);
        // }
        // {
        //     let c = &p.publishing_criteria[3];
        //     assert_eq!(c.feed_id, 2);
        //     assert_eq!(c.skip_publish_if_less_then_percentage, 0.0f64);
        //     assert_eq!(c.always_publish_heartbeat_ms, None);
        //     assert_eq!(c.peg_to_value, None);
        //     assert_eq!(c.peg_tolerance_percentage, 0.0f64);
        // }
        // {
        //     let c = &p.publishing_criteria[4];
        //     assert_eq!(c.feed_id, 22);
        //     assert_eq!(c.skip_publish_if_less_then_percentage, 0.0f64);
        //     assert_eq!(c.always_publish_heartbeat_ms, None);
        //     assert_eq!(c.peg_to_value, Some(1.995f64));
        //     assert_eq!(c.peg_tolerance_percentage, 0.0f64);
        // }
        // {
        //     let c = &p.publishing_criteria[5];
        //     assert_eq!(c.feed_id, 23);
        //     assert_eq!(c.skip_publish_if_less_then_percentage, 0.0f64);
        //     assert_eq!(c.always_publish_heartbeat_ms, None);
        //     assert_eq!(c.peg_to_value, Some(1.0f64));
        //     assert_eq!(c.peg_tolerance_percentage, 1.3f64);
        // }
        // {
        //     let c = &p.publishing_criteria[6];
        //     assert_eq!(c.feed_id, 24);
        //     assert_eq!(c.skip_publish_if_less_then_percentage, 0.0f64);
        //     assert_eq!(c.always_publish_heartbeat_ms, None);
        //     assert_eq!(c.peg_to_value, None);
        //     assert_eq!(c.peg_tolerance_percentage, 4.3f64);
        // }

        // {
        //     let c = &p.publishing_criteria[7];
        //     assert_eq!(c.feed_id, 25);
        //     assert_eq!(c.skip_publish_if_less_then_percentage, 1.32f64);
        //     assert_eq!(c.always_publish_heartbeat_ms, Some(45_000));
        //     assert_eq!(c.peg_to_value, Some(5.0f64));
        //     assert_eq!(c.peg_tolerance_percentage, 1.3f64);
        // }
    }

    #[test]
    fn test_parsing_feed_config_v2() {
        let json = r#"
        {
            "feeds": [
                {
                "id": "0",
                "full_name": "BTC / USD",
                "description": "Price of Bitcoin in USD",
                "type": "price-feed",
                "oracle_id": "cex-price-feeds",
                "value_type": "numerical",
                "stride": 0,
                "quorum": {
                    "percentage": 75,
                    "aggregation": "median"
                },
                "schedule": {
                    "interval_ms": 90000,
                    "heartbeat_ms": 3600000,
                    "deviation_percentage": 0.1,
                    "first_report_start_unix_time_ms": 0
                },
                "additional_feed_info": {
                    "pair": {
                    "base": "BTC",
                    "quote": "USD"
                    },
                    "decimals": 8,
                    "category": "Crypto",
                    "market_hours": "Crypto",
                    "arguments": {
                    "exchanges": {
                        "Binance": {
                        "symbol": ["BTCUSDC", "BTCUSDT"]
                        },
                        "BinanceUS": {
                        "symbol": ["BTCUSD", "BTCUSDC", "BTCUSDT"]
                        },
                        "Bitfinex": {
                        "symbol": ["tBTCUSD"]
                        },
                        "Bitget": {
                        "symbol": ["BTCUSDC", "BTCUSDT"]
                        },
                        "Bybit": {
                        "symbol": ["BTCUSDC", "BTCUSDT"]
                        },
                        "Coinbase": {
                        "id": ["BTC-USD", "BTC-USDT"]
                        },
                        "CryptoCom": {
                        "symbol": ["BTC_USD", "BTC_USDT"]
                        },
                        "GateIo": {
                        "id": ["BTC_USDC", "BTC_USDT"]
                        },
                        "Gemini": {
                        "symbol": ["BTCUSD", "BTCUSDT"]
                        },
                        "KuCoin": {
                        "symbol": ["BTC-USDC", "BTC-USDT"]
                        },
                        "MEXC": {
                        "symbol": ["BTCUSDC", "BTCUSDT"]
                        },
                        "OKX": {
                        "instId": ["BTC-USD", "BTC-USDC", "BTC-USDT"]
                        },
                        "Upbit": {
                        "market": ["USDT-BTC"]
                        }
                    },
                    "aggregators": {
                        "CoinMarketCap": {
                        "symbol": ["BTC", "BTC", "BTC", "BTC", "BTC"],
                        "id": [1, 31469, 31652, 32295, 34316]
                        }
                    }
                    },
                    "compatibility_info": {
                    "chainlink": "BTC / USD"
                    }
                }
                }
            ]
    }
"#;

        let config = serde_json::from_str::<AllFeedsConfig>(json)
            .map_err(|e| anyhow::anyhow!("Config is not valid JSON! {e}"))
            .unwrap();
        assert_eq!(config.feeds.len(), 1);

        assert_eq!(config.feeds[0].id, 0_u128);
        assert_eq!(config.feeds[0].stride, 0);
    }
}
