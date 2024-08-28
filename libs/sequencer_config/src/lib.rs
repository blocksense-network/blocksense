use hex::decode;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::File;
use std::io::Write;
use std::time::SystemTime;
use std::{collections::HashMap, env, fmt::Debug};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AssetPair {
    pub base: String,
    pub quote: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChainlinkCompatibility {
    pub base: String,
    pub quote: String,
}

pub trait Validated {
    fn validate(&self, context: &str) -> anyhow::Result<()>;
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FeedConfig {
    pub id: u32,
    pub name: String,
    pub description: String,
    pub decimals: u8,
    pub script: String,
    pub pair: AssetPair,
    pub report_interval_ms: u64,
    pub quorum_percentage: f32, // The percentage of votes needed to aggregate and post result to contract.
    pub first_report_start_time: SystemTime,
    pub chainlink_compatiblity: Option<ChainlinkCompatibility>,
}

impl Validated for FeedConfig {
    fn validate(&self, context: &str) -> anyhow::Result<()> {
        if self.report_interval_ms == 0 {
            anyhow::bail!(
                "{}: report_interval_ms for feed {} with id {} cannot be set to 0",
                context,
                self.name,
                self.id
            );
        }
        if self.quorum_percentage < 0.0 || self.quorum_percentage > 1.0 {
            anyhow::bail!(
                "{}: quorum_percentage for feed {} with id {} must be between 0.0 and 1.0",
                context,
                self.name,
                self.id
            );
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
pub struct ReporterConfig {
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

#[derive(Debug, Serialize, Deserialize)]
// #[serde(rename_all = "PascalCase")]
pub struct Provider {
    pub private_key_path: String,
    pub url: String,
    pub contract_address: Option<String>,
    pub event_contract_address: Option<String>,
    pub transcation_timeout_secs: u32,
}

impl Validated for Provider {
    fn validate(&self, context: &str) -> anyhow::Result<()> {
        if self.transcation_timeout_secs == 0 {
            anyhow::bail!("{}: transcation_timeout_secs cannot be set to 0", context);
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
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
#[derive(Debug, Serialize, Deserialize)]
pub struct SequencerConfig {
    pub main_port: u16,
    pub admin_port: u16,
    pub prometheus_port: u16,
    pub max_keys_to_batch: usize,
    pub keys_batch_duration: u64,
    pub providers: HashMap<String, Provider>,
    pub reporters: Vec<Reporter>,
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

pub fn get_config_file_path(base_path_from_env: &str, config_file_name: &str) -> String {
    let config_file_path = env::var(base_path_from_env).unwrap_or_else(|_| {
        let conf_dir = dirs::config_dir().expect("Configuration file path not specified.");
        conf_dir
            .to_str()
            .expect("Configuration file path not valid.")
            .to_string()
    });
    config_file_path + config_file_name
}

pub fn get_test_config_with_single_provider(
    network: &str,
    private_key_path: &str,
    url: &str,
) -> SequencerConfig {
    let mut file = File::create(private_key_path)
        .unwrap_or_else(|_| panic!("Could not create file {}", private_key_path));
    file.write_all(b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356")
        .unwrap_or_else(|_| panic!("Could not write to file {}", private_key_path));

    SequencerConfig {
        main_port: 8877,
        admin_port: 5556,
        prometheus_port: 5555,
        max_keys_to_batch: 1,
        keys_batch_duration: 500,
        providers: HashMap::from([(
            network.to_string(),
            Provider {
                private_key_path: private_key_path.to_string(),
                url: url.to_string(),
                contract_address: None,
                event_contract_address: None,
                transcation_timeout_secs: 50,
            },
        )]),
        reporters: Vec::new(),
    }
}

pub fn get_test_config_with_multiple_providers(
    provider_details: Vec<(&str, &str, &str)>,
) -> SequencerConfig {
    let mut providers = HashMap::new();

    for (network, private_key_path, url) in provider_details {
        let mut file = File::create(private_key_path)
            .unwrap_or_else(|_| panic!("Could not create file {}", private_key_path));
        file.write_all(b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356")
            .unwrap_or_else(|_| panic!("Could not write to file {}", private_key_path));

        providers.insert(
            network.to_string(),
            Provider {
                private_key_path: private_key_path.to_string(),
                url: url.to_string(),
                contract_address: None,
                event_contract_address: None,
                transcation_timeout_secs: 50,
            },
        );
    }

    SequencerConfig {
        main_port: 8877,
        admin_port: 5556,
        prometheus_port: 5555,
        max_keys_to_batch: 1,
        keys_batch_duration: 500,
        providers,
        reporters: Vec::new(),
    }
}
