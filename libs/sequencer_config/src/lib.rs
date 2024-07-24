use serde::{Deserialize, Serialize};
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

#[derive(Debug, Deserialize)]
pub struct ReporterConfig {
    pub batch_size: usize,
    pub sequencer_url: String,
    pub prometheus_url: String,
    pub poll_period_ms: u64, // TODO(snikolov): Move inside `Reporter` different poll periods are handled in reporter

    pub resources: HashMap<String, String>, // <`API`,`API_resource_dir`>
    pub reporter: Reporter,
}

#[derive(Debug, Deserialize)]
// #[serde(rename_all = "PascalCase")]
pub struct Provider {
    pub private_key_path: String,
    pub url: String,
    pub contract_address: Option<String>,
    pub event_contract_address: Option<String>,
    pub transcation_timeout_secs: u32,
}

#[derive(Debug, Deserialize)]
pub struct Reporter {
    pub id: u32,
    pub pub_key: String,
}

#[derive(Debug, Deserialize)]
pub struct SequencerConfig {
    pub main_port: u16,
    pub admin_port: u16,
    pub prometheus_port: u16,
    pub max_keys_to_batch: usize,
    pub keys_batch_duration: u64,
    pub providers: HashMap<String, Provider>,
    pub reporters: Vec<Reporter>,
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
        .expect(format!("Could not create file {}", private_key_path).as_str());
    file.write_all(b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356")
        .expect(format!("Could not write to file {}", private_key_path).as_str());

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
            .expect(format!("Could not create file {}", private_key_path).as_str());
        file.write_all(b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356")
            .expect(format!("Could not write to file {}", private_key_path).as_str());

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
