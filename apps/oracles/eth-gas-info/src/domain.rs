use anyhow::{Context, Result};
use blocksense_sdk::oracle::Settings;
use serde::Deserialize;
use tracing::error;

#[derive(Debug, Deserialize)]
pub struct Pair {
    pub base: String,
}

#[derive(Debug, Deserialize)]
pub struct FeedConfig {
    pub pair: Pair,
}

/// Parse feed configurations from settings
pub fn get_feed_configs_from_settings(settings: &Settings) -> Result<Vec<FeedConfig>> {
    let mut configs = Vec::with_capacity(settings.data_feeds.len());

    for feed in &settings.data_feeds {
        let cfg: FeedConfig = serde_json::from_str(&feed.data)
            .with_context(|| {
                format!(
                    "Failed to parse feed data JSON for feed id {}: {}",
                    feed.id, feed.data
                )
            })
            .map_err(|e| {
                error!("Error parsing feed config for feed id {}: {}", feed.id, e);
                e
            })?;
        configs.push(cfg);
    }

    Ok(configs)
}
