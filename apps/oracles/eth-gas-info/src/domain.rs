use anyhow::{Result};
use blocksense_sdk::oracle::Settings;
use serde::Deserialize;

pub type FeedId = u128;

#[derive(Debug, Deserialize)]
pub struct GasInfoArguments {
    pub metric: String,
}

#[derive(Debug, Deserialize)]
pub struct FeedConfig {
    #[serde(default)]
    pub id: FeedId,
    pub arguments: GasInfoArguments,
}

pub fn get_resources_from_settings(settings: &Settings) -> Result<Vec<FeedConfig>> {
    let mut config: Vec<FeedConfig> = Vec::new();

    for feed_setting in &settings.data_feeds {
        match serde_json::from_str::<FeedConfig>(&feed_setting.data) {
            Ok(mut feed_config) => {
                feed_config.id = feed_setting.id.parse::<FeedId>()?;
                config.push(feed_config);
            }
            Err(err) => {
                println!(
                    "Error {err} when parsing feed settings data = '{}'",
                    &feed_setting.data
                );
            }
        }
    }

    Ok(config)
}
