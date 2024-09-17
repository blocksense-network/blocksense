use eyre::Result;
use sequencer_config::{SequencerConfig, Validated};
use std::path::PathBuf;
use tracing::info;
use utils::read_file;

pub fn init_sequencer_config(config_file: &PathBuf) -> Result<SequencerConfig> {
    let config_file = config_file
        .to_str()
        .expect("Environment variable does not hold a dir path");

    let data = read_file(config_file);

    info!("Using config file: {}", config_file);

    match serde_json::from_str::<SequencerConfig>(data.as_str()) {
        Ok(c) => Ok(c),
        Err(e) => eyre::bail!("Config file ({}) is not valid JSON! {}", config_file, e),
    }
}

pub fn get_validated_sequencer_config(config_file: &PathBuf) -> SequencerConfig {
    let sequencer_config = init_sequencer_config(config_file).expect("Failed to get config: ");

    sequencer_config
        .validate("SequencerConfig")
        .expect("validation error");

    sequencer_config
}

#[cfg(test)]
mod tests {
    use utils::get_config_file_path;

    use super::*;
    use std::fs::File;
    use std::io::prelude::*;

    #[test]
    fn test_get_validated_sequencer_config_with_error_in_set_endpoint_ports() {
        let config_file_path =
            get_config_file_path("SEQUENCER_CONFIG_DIR", "sequencer_config.json");
        let config_file_path = config_file_path.to_str().expect("");

        let data = read_file(config_file_path);
        let mut config_json = match serde_json::from_str::<SequencerConfig>(data.as_str()) {
            Ok(c) => c,
            Err(e) => panic!(
                "Config file ({}) is not valid JSON! {}",
                config_file_path, e
            ),
        };
        config_json.main_port = config_json.admin_port; // Set an error in the config - endpoints cannot have same ports.

        let mut file = File::create("/tmp/sequencer_config.json")
            .expect("Could not create sequencer config file!");
        file.write(serde_json::to_string(&config_json).unwrap().as_bytes())
            .expect("Could not write to sequencer config file");
        file.flush().expect("Could flush sequencer config file");

        let path = PathBuf::new().join("/tmp");
        let _ = std::panic::catch_unwind(|| get_validated_sequencer_config(&path));
    }
}
