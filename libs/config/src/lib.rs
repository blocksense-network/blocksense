use blocksense_registry::config::FeedConfig;
use hex::decode;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use std::time::SystemTime;
use std::{collections::HashMap, fmt::Debug};
use tracing::{info, warn};
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

pub struct FeedStrideAndDecimals {
    pub stride: u16,
    pub decimals: u8,
}

impl FeedStrideAndDecimals {
    pub fn from_feed_config(feed_config: &Option<FeedConfig>) -> FeedStrideAndDecimals {
        let stride = match &feed_config {
            Some(f) => f.stride,
            None => {
                warn!("Propagating result for unregistered feed! Support left for legacy one shot feeds of 32 bytes size.");
                1
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
pub struct PublishCriteria {
    pub feed_id: u32,
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
// #[serde(rename_all = "PascalCase")]
pub struct Provider {
    pub private_key_path: String,
    pub url: String,
    pub contract_address: Option<String>,
    pub safe_address: Option<String>,
    pub safe_min_quorum: u32,
    pub event_contract_address: Option<String>,
    pub multicall_contract_address: Option<String>,
    pub transaction_drop_timeout_secs: u32,
    pub transaction_retry_timeout_secs: u32,
    pub retry_fee_increment_fraction: f64,
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

    #[serde(default)]
    pub publishing_criteria: Vec<PublishCriteria>,

    #[serde(default = "contract_initial_version")]
    pub contract_version: u16, // TODO: remove when migration ot ADFS contracts is complete
}

fn default_is_enabled() -> bool {
    true
}

fn contract_initial_version() -> u16 {
    1
}

impl Validated for Provider {
    fn validate(&self, context: &str) -> anyhow::Result<()> {
        if self.transaction_drop_timeout_secs == 0 {
            anyhow::bail!(
                "{}: transaction_drop_timeout_secs cannot be set to 0",
                context
            );
        }
        if self.transaction_retry_timeout_secs == 0 {
            anyhow::bail!(
                "{}: transaction_drop_timeout_secs cannot be set to 0",
                context
            );
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
    pub genesis_block_timestamp: Option<SystemTime>,
    pub aggregation_consensus_discard_period_blocks: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct KafkaReportEndpoint {
    pub url: Option<String>,
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
            genesis_block_timestamp: None,
            aggregation_consensus_discard_period_blocks: 100,
        },
        providers: HashMap::new(),
        reporters: Vec::new(),
        kafka_report_endpoint: KafkaReportEndpoint { url: None },
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
                contract_address: Some("0x663F3ad617193148711d28f5334eE4Ed07016602".to_string()),
                safe_address: None,
                safe_min_quorum: 1,
                event_contract_address: None,
                multicall_contract_address: None,
                transaction_drop_timeout_secs: 50,
                transaction_retry_timeout_secs: 24,
                retry_fee_increment_fraction: 0.1,
                transaction_gas_limit: 7500000,
                data_feed_store_byte_code: Some(test_data_feed_store_byte_code()),
                data_feed_sports_byte_code: Some(test_data_feed_sports_byte_code()),
                is_enabled: true,
                allow_feeds: None,
                publishing_criteria: vec![],
                impersonated_anvil_account: None,
                contract_version: 1,
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
    fn parsing_provider_config_missing_publish_criteria() {
        let provider_a: Provider = serde_json::from_str(r#"
            {
            "private_key_path": "/tmp/priv_key_test",
            "url": "http://127.0.0.1:8546",
            "transaction_drop_timeout_secs": 42,
            "transaction_retry_timeout_secs": 20,
            "retry_fee_increment_fraction": 0.1,
            "transaction_gas_limit": 7500000,
            "contract_address": "0x663F3ad617193148711d28f5334eE4Ed07016602",
            "safe_min_quorum": 1,
            "data_feed_store_byte_code": "0x60a060405234801561001057600080fd5b506040516101cf3803806101cf83398101604081905261002f91610040565b6001600160a01b0316608052610070565b60006020828403121561005257600080fd5b81516001600160a01b038116811461006957600080fd5b9392505050565b60805161014561008a6000396000609001526101456000f3fe608060405234801561001057600080fd5b50600060405160046000601c83013751905063e000000081161561008e5763e0000000198116632000000082161561005957806020526004356004603c20015460005260206000f35b805463800000008316156100775781600052806004601c2001546000525b634000000083161561008857806020525b60406000f35b7f00000000000000000000000000000000000000000000000000000000000000003381146100bb57600080fd5b631a2d80ac820361010a57423660045b8181101561010857600481601c376000516004601c2061ffff6001835408806100f2575060015b91829055600483013585179101556024016100cb565b005b600080fdfea26469706673582212204a7c38e6d9b723ea65e6d451d6a8436444c333499ad610af033e7360a2558aea64736f6c63430008180033",
            "data_feed_sports_byte_code": "0x60a0604052348015600e575f80fd5b503373ffffffffffffffffffffffffffffffffffffffff1660808173ffffffffffffffffffffffffffffffffffffffff168152505060805161020e61005a5f395f60b1015261020e5ff3fe608060405234801561000f575f80fd5b5060045f601c375f5163800000008116156100ad5760043563800000001982166040517ff0000f000f00000000000000000000000000000000000000000000000000000081528160208201527ff0000f000f0000000000000001234000000000000000000000000000000000016040820152606081205f5b848110156100a5578082015460208202840152600181019050610087565b506020840282f35b505f7f000000000000000000000000000000000000000000000000000000000000000090503381146100dd575f80fd5b5f51631a2d80ac81036101d4576040513660045b818110156101d0577ff0000f000f0000000000000000000000000000000000000000000000000000008352600481603c8501377ff0000f000f000000000000000123400000000000000000000000000000000001604084015260608320600260048301607e86013760608401516006830192505f5b81811015610184576020810284013581840155600181019050610166565b50806020028301925060208360408701377fa826448a59c096f4c3cbad79d038bc4924494a46fc002d46861890ec5ac62df0604060208701a150506020810190506080830192506100f1565b5f80f35b5f80fdfea2646970667358221220b77f3ab2f01a4ba0833f1da56458253968f31db408e07a18abc96dd87a272d5964736f6c634300081a0033"
            }"#).unwrap();
        assert_eq!(provider_a.is_enabled, true);
        assert_eq!(provider_a.event_contract_address, None);
        assert_eq!(&provider_a.private_key_path, "/tmp/priv_key_test");
        assert_eq!(&provider_a.url, "http://127.0.0.1:8546");
        assert_eq!(provider_a.transaction_drop_timeout_secs, 42_u32);
        assert_eq!(provider_a.transaction_retry_timeout_secs, 20_u32);
        assert_eq!(provider_a.retry_fee_increment_fraction, 0.1f64);
        assert_eq!(provider_a.transaction_gas_limit, 7500000_u32);
        assert_eq!(
            provider_a.contract_address,
            Some("0x663F3ad617193148711d28f5334eE4Ed07016602".to_string())
        );
        assert_eq!(
            provider_a.data_feed_store_byte_code,
            Some(test_data_feed_store_byte_code())
        );
        assert_eq!(
            provider_a.data_feed_sports_byte_code,
            Some(test_data_feed_sports_byte_code())
        );
        assert_eq!(provider_a.allow_feeds, None);
        assert_eq!(provider_a.publishing_criteria.len(), 0);
        assert_eq!(provider_a.impersonated_anvil_account, None);
    }

    #[test]
    fn parsing_provider_config_with_publish_criteria() {
        let p: Provider = serde_json::from_str(r#"
            {
            "private_key_path": "/tmp/priv_key_test",
            "url": "http://127.0.0.1:8546",
            "transaction_drop_timeout_secs": 42,
            "transaction_retry_timeout_secs": 20,
            "retry_fee_increment_fraction": 0.1,
            "transaction_gas_limit": 7500000,
            "contract_address": "0x663F3ad617193148711d28f5334eE4Ed07016602",
            "safe_min_quorum": 1,
            "data_feed_store_byte_code": "0x60a060405234801561001057600080fd5b506040516101cf3803806101cf83398101604081905261002f91610040565b6001600160a01b0316608052610070565b60006020828403121561005257600080fd5b81516001600160a01b038116811461006957600080fd5b9392505050565b60805161014561008a6000396000609001526101456000f3fe608060405234801561001057600080fd5b50600060405160046000601c83013751905063e000000081161561008e5763e0000000198116632000000082161561005957806020526004356004603c20015460005260206000f35b805463800000008316156100775781600052806004601c2001546000525b634000000083161561008857806020525b60406000f35b7f00000000000000000000000000000000000000000000000000000000000000003381146100bb57600080fd5b631a2d80ac820361010a57423660045b8181101561010857600481601c376000516004601c2061ffff6001835408806100f2575060015b91829055600483013585179101556024016100cb565b005b600080fdfea26469706673582212204a7c38e6d9b723ea65e6d451d6a8436444c333499ad610af033e7360a2558aea64736f6c63430008180033",
            "data_feed_sports_byte_code": "0x60a0604052348015600e575f80fd5b503373ffffffffffffffffffffffffffffffffffffffff1660808173ffffffffffffffffffffffffffffffffffffffff168152505060805161020e61005a5f395f60b1015261020e5ff3fe608060405234801561000f575f80fd5b5060045f601c375f5163800000008116156100ad5760043563800000001982166040517ff0000f000f00000000000000000000000000000000000000000000000000000081528160208201527ff0000f000f0000000000000001234000000000000000000000000000000000016040820152606081205f5b848110156100a5578082015460208202840152600181019050610087565b506020840282f35b505f7f000000000000000000000000000000000000000000000000000000000000000090503381146100dd575f80fd5b5f51631a2d80ac81036101d4576040513660045b818110156101d0577ff0000f000f0000000000000000000000000000000000000000000000000000008352600481603c8501377ff0000f000f000000000000000123400000000000000000000000000000000001604084015260608320600260048301607e86013760608401516006830192505f5b81811015610184576020810284013581840155600181019050610166565b50806020028301925060208360408701377fa826448a59c096f4c3cbad79d038bc4924494a46fc002d46861890ec5ac62df0604060208701a150506020810190506080830192506100f1565b5f80f35b5f80fdfea2646970667358221220b77f3ab2f01a4ba0833f1da56458253968f31db408e07a18abc96dd87a272d5964736f6c634300081a0033",
            "publishing_criteria": [
                {
                    "feed_id": 13,
                    "skip_publish_if_less_then_percentage": 13.2,
                    "always_publish_heartbeat_ms": 50000
                },
                {
                    "feed_id": 15,
                    "skip_publish_if_less_then_percentage": 2.2
                },
                {
                    "feed_id": 8,
                    "always_publish_heartbeat_ms": 12345
                },
                {
                    "feed_id": 2
                },
                {
                    "feed_id": 22,
                    "peg_to_value": 1.995
                },
                {
                    "feed_id": 23,
                    "peg_to_value": 1.00,
                    "peg_tolerance_percentage": 1.3
                },
                {
                    "feed_id": 24,
                    "peg_tolerance_percentage": 4.3
                },
                {
                    "feed_id": 25,
                    "skip_publish_if_less_then_percentage": 1.32,
                    "always_publish_heartbeat_ms": 45000,
                    "peg_to_value": 5.00,
                    "peg_tolerance_percentage": 1.3
                }
            ]
            }"#).unwrap();
        assert_eq!(p.is_enabled, true);
        assert_eq!(p.event_contract_address, None);
        assert_eq!(&p.private_key_path, "/tmp/priv_key_test");
        assert_eq!(&p.url, "http://127.0.0.1:8546");
        assert_eq!(p.transaction_drop_timeout_secs, 42_u32);
        assert_eq!(p.transaction_retry_timeout_secs, 20_u32);
        assert_eq!(p.retry_fee_increment_fraction, 0.1f64);
        assert_eq!(p.transaction_gas_limit, 7500000_u32);
        assert_eq!(
            p.contract_address,
            Some("0x663F3ad617193148711d28f5334eE4Ed07016602".to_string())
        );
        assert_eq!(
            p.data_feed_store_byte_code,
            Some(test_data_feed_store_byte_code())
        );
        assert_eq!(
            p.data_feed_sports_byte_code,
            Some(test_data_feed_sports_byte_code())
        );
        assert_eq!(p.allow_feeds, None);
        assert_eq!(p.publishing_criteria.len(), 8);
        assert_eq!(p.impersonated_anvil_account, None);

        {
            let c = &p.publishing_criteria[0];
            assert_eq!(c.feed_id, 13);
            assert_eq!(c.skip_publish_if_less_then_percentage, 13.2f64);
            assert_eq!(c.always_publish_heartbeat_ms, Some(50_000));
            assert_eq!(p.publishing_criteria[0].peg_to_value, None);
            assert_eq!(p.publishing_criteria[0].peg_tolerance_percentage, 0.0f64);
        }

        {
            let c = &p.publishing_criteria[1];
            assert_eq!(c.feed_id, 15);
            assert_eq!(c.skip_publish_if_less_then_percentage, 2.2f64);
            assert_eq!(c.always_publish_heartbeat_ms, None);
            assert_eq!(c.peg_to_value, None);
            assert_eq!(c.peg_tolerance_percentage, 0.0f64);
        }
        {
            let c = &p.publishing_criteria[2];
            assert_eq!(c.feed_id, 8);
            assert_eq!(c.skip_publish_if_less_then_percentage, 0.0f64);
            assert_eq!(c.always_publish_heartbeat_ms, Some(12_345));
            assert_eq!(c.peg_to_value, None);
            assert_eq!(c.peg_tolerance_percentage, 0.0f64);
        }
        {
            let c = &p.publishing_criteria[3];
            assert_eq!(c.feed_id, 2);
            assert_eq!(c.skip_publish_if_less_then_percentage, 0.0f64);
            assert_eq!(c.always_publish_heartbeat_ms, None);
            assert_eq!(c.peg_to_value, None);
            assert_eq!(c.peg_tolerance_percentage, 0.0f64);
        }
        {
            let c = &p.publishing_criteria[4];
            assert_eq!(c.feed_id, 22);
            assert_eq!(c.skip_publish_if_less_then_percentage, 0.0f64);
            assert_eq!(c.always_publish_heartbeat_ms, None);
            assert_eq!(c.peg_to_value, Some(1.995f64));
            assert_eq!(c.peg_tolerance_percentage, 0.0f64);
        }
        {
            let c = &p.publishing_criteria[5];
            assert_eq!(c.feed_id, 23);
            assert_eq!(c.skip_publish_if_less_then_percentage, 0.0f64);
            assert_eq!(c.always_publish_heartbeat_ms, None);
            assert_eq!(c.peg_to_value, Some(1.0f64));
            assert_eq!(c.peg_tolerance_percentage, 1.3f64);
        }
        {
            let c = &p.publishing_criteria[6];
            assert_eq!(c.feed_id, 24);
            assert_eq!(c.skip_publish_if_less_then_percentage, 0.0f64);
            assert_eq!(c.always_publish_heartbeat_ms, None);
            assert_eq!(c.peg_to_value, None);
            assert_eq!(c.peg_tolerance_percentage, 4.3f64);
        }

        {
            let c = &p.publishing_criteria[7];
            assert_eq!(c.feed_id, 25);
            assert_eq!(c.skip_publish_if_less_then_percentage, 1.32f64);
            assert_eq!(c.always_publish_heartbeat_ms, Some(45_000));
            assert_eq!(c.peg_to_value, Some(5.0f64));
            assert_eq!(c.peg_tolerance_percentage, 1.3f64);
        }
    }
}
