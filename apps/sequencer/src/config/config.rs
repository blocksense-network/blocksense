use serde::Deserialize;
use std::collections::HashMap;
use std::env;
use std::fs::File;
use std::io::Read;
use tracing::warn;

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
}

pub fn init_sequencer_config() -> SequencerConfig {
    let config_file_path = env::var("SEQUENCER_CONFIG_FILE").unwrap_or_else(|_| {
        warn!("No config file path provided in environment variable SEQUENCER_CONFIG_FILE. Will use config.json from ./apps/sequencer.");
        "./apps/sequencer/config.json".to_string()
    });
    let mut file = File::open(config_file_path.clone())
        .expect(format!("Sequencer config file not found in {}", config_file_path).as_str());
    let mut data = String::new();
    file.read_to_string(&mut data).unwrap();

    let sequencer_config: SequencerConfig =
        serde_json::from_str(data.as_str()).expect("JSON config was not well-formatted");

    sequencer_config
}
