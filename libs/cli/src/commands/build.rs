use std::{convert::From, fs, io::prelude::*, path::PathBuf};

use tokio::process::Command;

use anyhow::Result;
use clap::Parser;
use std::process::Stdio;

use blocksense_registry::config::BlocksenseConfig;

use crate::opts::{APP_MANIFEST_FILE_OPT, BUILD_UP_OPT};

use crate::spin_manifest::AppManifest as SpinConfigToml;

#[derive(Debug, Parser)]
#[command(about = "Build the Blocksense application", allow_hyphen_values = true)]
pub struct BuildConfig {
    /// The application to build. This may be a manifest (blocksense.json) file, or a
    /// directory containing a blocksense.json file.
    #[arg(
        name = APP_MANIFEST_FILE_OPT,
        short = 'f',
        long = "from",
        alias = "file",
    )]
    pub file_path: PathBuf,

    /// Run the application after building.
    #[arg(name = BUILD_UP_OPT, short = 'u', long = "up")]
    pub up: bool,
}

impl BuildConfig {
    pub async fn run(self) -> Result<()> {
        let contents = fs::read_to_string(self.file_path)?;
        let config: BlocksenseConfig = serde_json::from_str(&contents)?;
        let spin_config = SpinConfigToml::from(config);
        let toml = toml::to_string_pretty(&spin_config)?;
        let mut file = fs::File::create("spin.toml")?;
        file.write_all(toml.as_bytes())?;

        if self.up {
            // TODO(adikov): Change the way we depend on spin being installed.
            Command::new("spin")
                .arg("up")
                .stdout(Stdio::inherit())
                .stderr(Stdio::inherit())
                .spawn()?
                .wait()
                .await?;
        }
        Ok(())
    }
}
