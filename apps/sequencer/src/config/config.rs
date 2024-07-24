use sequencer_config::{get_config_file_path, SequencerConfig};
use tracing::info;
use utils::read_file;

pub fn init_sequencer_config() -> SequencerConfig {
    let config_file_path = get_config_file_path("SEQUENCER_CONFIG_DIR", "/sequencer_config.json");

    let data = read_file(config_file_path.as_str());

    info!("Using config file: {}", config_file_path.as_str());

    let sequencer_config: SequencerConfig = serde_json::from_str(data.as_str()).expect(
        format!(
            "Config file ({}) is not valid JSON!",
            config_file_path.as_str()
        )
        .as_str(),
    );

    sequencer_config
}
