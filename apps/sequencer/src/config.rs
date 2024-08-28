use eyre::Result;
use sequencer_config::{get_config_file_path, SequencerConfig, Validated};
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

pub fn get_validated_sequencer_config() -> SequencerConfig {
    let sequencer_config = init_sequencer_config().expect("Failed to get config: ");

    sequencer_config
        .validate("SequencerConfig")
        .expect("validation error");

    sequencer_config
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    #[test]
    fn test_get_validated_sequencer_config_with_error_in_set_endpoint_ports() {
        let config_file_path =
            get_config_file_path("SEQUENCER_CONFIG_DIR", "/sequencer_config.json");
        let data = read_file(config_file_path.as_str());
        let mut config_json = match serde_json::from_str::<SequencerConfig>(data.as_str()) {
            Ok(c) => c,
            Err(e) => panic!(
                "Config file ({}) is not valid JSON! {}",
                config_file_path.as_str(),
                e
            ),
        };
        config_json.main_port = config_json.admin_port; // Set an error in the config - endpoints cannot have same ports.
        fs::write(
            "/tmp/sequencer_config.json",
            serde_json::to_string(&config_json).unwrap(),
        )
        .expect("Unable to write sequencer config file");

        env::set_var("SEQUENCER_CONFIG_DIR", "/tmp");
        let _ = std::panic::catch_unwind(|| get_validated_sequencer_config());
    }
}
