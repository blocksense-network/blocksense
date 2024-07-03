use serde::Deserialize;
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
}

#[derive(Debug, Deserialize)]
pub struct SequencerConfig {
    pub max_keys_to_batch: usize,
    pub keys_batch_duration: u64,
    pub providers: HashMap<String, Provider>,
    pub feeds: Vec<FeedMetaData>,
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
