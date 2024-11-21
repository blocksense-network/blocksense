use std::{convert::From, path::PathBuf, process::Stdio};

use tokio::{fs, io::AsyncWriteExt, process::Command};

use anyhow::Result;
use clap::Parser;
use url::Url;

use blocksense_registry::config::{BlocksenseConfig, FeedsResponse, OraclesResponse};

use crate::opts::{APP_MANIFEST_FILE_OPT, BUILD_UP_OPT};

use crate::spin_manifest::AppManifest as SpinConfigToml;

static JSON: &str = "json";
static SPIN: &str = "spin.toml";

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
        let mut contents = String::new();
        if self.file_path.is_file() {
            contents = fs::read_to_string(&self.file_path).await?;
        } else if self.file_path.is_dir() {
            let mut entries = fs::read_dir(&self.file_path).await?;
            while let Some(entry) = entries.next_entry().await? {
                let path = entry.path();
                if let Some(extension) = path.extension() {
                    if extension == JSON {
                        contents = fs::read_to_string(path).await?;
                        break;
                    }
                }
            }
        }

        if contents.is_empty() {
            anyhow::bail!(
                "No blocksense configuration existing at file path: {}",
                &self.file_path.display()
            );
        }
        let mut config: BlocksenseConfig = serde_json::from_str(&contents)?;
        if config.data_feeds.is_empty() {
            let base = Url::parse(&config.reporter_info.registry)?;
            let url = base.join("/get_feeds_config")?;
            tracing::info!("Getting data feed config from {:?}", url);

            let body = reqwest::get(url.clone()).await?.text().await?;

            let response_json: FeedsResponse = serde_json::from_str(&body)?;
            config.data_feeds = response_json
                .feeds
                .into_iter()
                .map(|mut feed| {
                    if feed.script == "YahooFinance" {
                        feed.script = "yahoo".to_string();
                    } else if feed.script == "CoinMarketCap" {
                        feed.script = "cmc".to_string();
                    }
                    feed
                })
                .collect();
        }

        if config.oracles.is_empty() {
            let base = Url::parse(&config.reporter_info.registry)?;
            let url = base.join("/get_oracle_scripts")?;
            tracing::info!("Getting oracles config from {:?}", url);

            let body = reqwest::get(url.clone()).await?.text().await?;

            let response_json: OraclesResponse = serde_json::from_str(&body)?;
            config.oracles = response_json.oracles
        }

        let spin_config = SpinConfigToml::from(config);
        let toml = toml::to_string_pretty(&spin_config)?;
        let mut file = fs::File::create(std::env::current_dir()?.join(SPIN)).await?;
        file.write_all(toml.as_bytes()).await?;

        if self.up {
            // TODO(adikov): Change the way we depend on spin being installed.
            Command::new("spin")
                .env("RUST_LOG", "trigger=trace")
                .arg("up")
                .arg("-f")
                .arg(std::env::current_dir()?.join(SPIN))
                .stdout(Stdio::inherit())
                .stderr(Stdio::inherit())
                .spawn()?
                .wait()
                .await?;
        }
        Ok(())
    }
}
