use eyre::Result;
use sequencer_config::{get_config_file_path, SequencerConfig};
use tracing::info;
use utils::read_file;

pub fn init_sequencer_config() -> Result<SequencerConfig> {
    let config_file_path = get_config_file_path("SEQUENCER_CONFIG_DIR", "/sequencer_config.json");

    let data = read_file(config_file_path.as_str());

    info!("Using config file: {}", config_file_path.as_str());

    match serde_json::from_str::<SequencerConfig>(data.as_str()) {
        Ok(c) => Ok(c),
        Err(e) => eyre::bail!(
            "Config file ({}) is not valid JSON! {}",
            config_file_path.as_str(),
            e
        ),
    }
}
