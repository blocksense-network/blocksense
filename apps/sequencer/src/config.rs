use eyre::Result;
use sequencer_config::{SequencerConfig, Validated};
use std::path::Path;
use tracing::info;
use utils::read_file;

pub fn init_sequencer_config(config_file: &Path) -> Result<SequencerConfig> {
    let config_file = match config_file.to_str() {
        Some(v) => v,
        None => eyre::bail!("Error converting path to str, needed to read file."),
    };

    let data = read_file(config_file);

    info!("Using config file: {config_file}");

    serde_json::from_str::<SequencerConfig>(data.as_str())
        .map_err(|e| eyre::eyre!("Config file ({config_file}) is not valid JSON! {e}"))
}

pub fn get_validated_sequencer_config(config_file: &Path) -> Result<SequencerConfig> {
    let sequencer_config = match init_sequencer_config(config_file) {
        Ok(v) => v,
        Err(e) => eyre::bail!("Failed to get config {e} "),
    };

    match sequencer_config.validate("SequencerConfig") {
        Ok(_) => Ok(sequencer_config),
        Err(e) => eyre::bail!("Validation error {e} "),
    }
}

#[cfg(test)]
mod tests {
    use utils::constants::{SEQUENCER_CONFIG_DIR, SEQUENCER_CONFIG_FILE};
    use utils::get_config_file_path;

    use super::*;
    use std::fs::File;
    use std::io::prelude::*;
    use std::path::PathBuf;

    #[test]
    fn test_get_validated_sequencer_config_with_error_in_set_endpoint_ports() {
        let config_file_path = get_config_file_path(SEQUENCER_CONFIG_DIR, SEQUENCER_CONFIG_FILE);
        let config_file_path = config_file_path
            .to_str()
            .expect("Error converting path to str, needed to read file.");

        let data = read_file(config_file_path);
        let mut config_json = match serde_json::from_str::<SequencerConfig>(data.as_str()) {
            Ok(c) => c,
            Err(e) => panic!("Config file ({config_file_path}) is not valid JSON! {e}"),
        };
        config_json.main_port = config_json.admin_port; // Set an error in the config - endpoints cannot have same ports.

        let mut file = File::create("/tmp/sequencer_config.json")
            .expect("Could not create sequencer config file!");
        file.write(serde_json::to_string(&config_json).unwrap().as_bytes())
            .expect("Could not write to sequencer config file");
        file.flush().expect("Could flush sequencer config file");

        let path = PathBuf::new().join("/tmp").join("sequencer_config.json");
        match get_validated_sequencer_config(&path) {
            Ok(_) => panic!("Did not detect error in config file!"),
            Err(_) => {}
        }
    }
}
