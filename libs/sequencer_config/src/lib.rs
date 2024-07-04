use serde::Deserialize;
use std::fs::File;
use std::io::Write;
use std::time::SystemTime;
use std::{collections::HashMap, env, fmt::Debug};

#[derive(Debug, Deserialize)]
pub struct FeedMetaData {
    pub id: u32,
    pub name: String,
    pub report_interval_ms: u64,
    pub first_report_start_time: SystemTime,
}

#[derive(Debug, Deserialize)]
// #[serde(rename_all = "PascalCase")]
pub struct Provider {
    pub private_key_path: String,
    pub url: String,
    pub contract_address: Option<String>,
    pub transcation_timeout_secs: u32,
}

#[derive(Debug, Deserialize)]
pub struct Reporter {
    pub id: u32,
    pub pub_key: String,
}

#[derive(Debug, Deserialize)]
pub struct SequencerConfig {
    pub max_keys_to_batch: usize,
    pub keys_batch_duration: u64,
    pub providers: HashMap<String, Provider>,
    pub feeds: Vec<FeedMetaData>,
    pub reporters: Vec<Reporter>,
}

pub fn get_sequencer_config_file_path() -> String {
    let config_file_name = "/sequencer_config.json";

    let config_file_path = env::var("SEQUENCER_CONFIG_DIR").unwrap_or_else(|_| {
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
        max_keys_to_batch: 1,
        keys_batch_duration: 500,
        providers: HashMap::from([(
            network.to_string(),
            Provider {
                private_key_path: private_key_path.to_string(),
                url: url.to_string(),
                contract_address: None,
                transcation_timeout_secs: 50,
            },
        )]),
        feeds: Vec::new(),
        reporters: Vec::new(),
    }
}
