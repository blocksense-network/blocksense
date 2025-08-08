use std::{convert::From, env, path::PathBuf, process::Stdio};

use tokio::{fs, io::AsyncWriteExt, process::Command, time::Duration};

use anyhow::{Context, Result};
use clap::Parser;
use url::Url;

use reqwest_middleware::ClientBuilder;
use reqwest_retry::{policies::ExponentialBackoff, RetryTransientMiddleware};

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
        let contents = self.read_config().await?;

        let mut config: BlocksenseConfig = serde_json::from_str(&contents)?;
        BuildConfig::read_secrets(&mut config).await?;

        if config.data_feeds.is_empty() {
            BuildConfig::fill_data_feeds_from_registry(&mut config).await?;
        }

        if config.oracles.is_empty() {
            BuildConfig::fill_oracles_from_registry(&mut config).await?;
        }

        BuildConfig::generate_reporter_config(config).await?;

        if self.up {
            BuildConfig::start_spin_runtime().await?;
        }

        Ok(())
    }

    async fn read_config(&self) -> Result<String> {
        let mut contents = String::new();
        if self.file_path.is_file() {
            tracing::info!("Reading from file: {:?}", &self.file_path);
            contents = fs::read_to_string(&self.file_path).await?;
        } else if self.file_path.is_dir() {
            tracing::info!("Reading from directory: {:?}", &self.file_path);
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

        Ok(contents)
    }

    async fn read_secrets(config: &mut BlocksenseConfig) -> Result<()> {
        replace_filepath_with_content(&mut config.reporter_info.secret_key).await?;

        if let Some(key) = config.reporter_info.second_consensus_secret_key.as_mut() {
            replace_filepath_with_content(key).await?;
        }

        for capability in config.capabilities.iter_mut() {
            let api_key_path = &capability
                .data
                .strip_suffix("\n")
                .unwrap_or(&capability.data);
            let mut api_key = fs::read_to_string(api_key_path)
                .await
                .context(format!("No such file - {}", &api_key_path))?;
            api_key = api_key.strip_suffix(&"\n").unwrap_or(&api_key).to_string();
            tracing::info!("API key {:?}", &api_key);
            capability.data = api_key;
        }

        Ok(())
    }

    async fn fill_data_feeds_from_registry(config: &mut BlocksenseConfig) -> Result<()> {
        let base = Url::parse(&config.reporter_info.registry)?;
        let url = base.join("/get_feeds_config")?;
        tracing::info!("Getting data feed config from {:?}", url);

        let retry_policy = ExponentialBackoff::builder()
            .retry_bounds(Duration::from_secs(1), Duration::from_secs(6))
            .build_with_total_retry_duration_and_max_retries(Duration::from_secs(124));
        let client = ClientBuilder::new(reqwest::Client::new())
            // Retry failed requests.
            .with(RetryTransientMiddleware::new_with_policy(retry_policy))
            .build();

        let body = client.get(url.clone()).send().await?.text().await?;

        let response_json: FeedsResponse = serde_json::from_str(&body)?;
        config.data_feeds = response_json.feeds;

        Ok(())
    }

    async fn fill_oracles_from_registry(config: &mut BlocksenseConfig) -> Result<()> {
        let base = Url::parse(&config.reporter_info.registry)?;
        let url = base.join("/get_oracle_scripts")?;
        tracing::info!("Getting oracles config from {:?}", url);

        let body = reqwest::get(url.clone()).await?.text().await?;

        let response_json: OraclesResponse = serde_json::from_str(&body)?;
        config.oracles = response_json.oracles;

        Ok(())
    }

    async fn start_spin_runtime() -> Result<()> {
        // TODO(adikov): Change the way we depend on spin being installed.
        let log_level = env::var("RUST_LOG").unwrap_or("trigger=trace".to_string());
        let path = std::env::current_dir()?.join(SPIN);
        tracing::info!(
            "Running command: RUST_LOG={} spin up -f {}",
            &log_level,
            path.display()
        );

        Command::new("spin")
            .env("RUST_LOG", log_level)
            .arg("up")
            .arg("-f")
            .arg(path)
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()?
            .wait()
            .await?;

        Ok(())
    }

    async fn generate_reporter_config(config: BlocksenseConfig) -> Result<()> {
        let spin_config = SpinConfigToml::from(config);
        let toml = toml::to_string_pretty(&spin_config)?;
        let mut file = fs::File::create(std::env::current_dir()?.join(SPIN)).await?;
        tracing::info!("Created spin configuraition: {:?}", &file);
        file.write_all(toml.as_bytes()).await?;

        Ok(())
    }
}

async fn replace_filepath_with_content(filepath: &mut String) -> Result<()> {
    let content = fs::read_to_string(&filepath)
        .await
        .context(format!("No such file - {}", &filepath))?;
    *filepath = content.trim().to_string();
    Ok(())
}
