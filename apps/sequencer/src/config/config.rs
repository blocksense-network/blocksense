use sequencer_config::{get_sequencer_config_file_path, SequencerConfig};
use tracing::info;
use utils::read_file;

pub fn init_sequencer_config() -> SequencerConfig {
    let config_file_path = get_sequencer_config_file_path();

    let data = read_file(config_file_path.as_str());

    info!("Using config file: {}", config_file_path.as_str());

    let sequencer_config: SequencerConfig =
        serde_json::from_str(data.as_str()).expect("Config file is not valid JSON!");

    sequencer_config
}
