use std::collections::HashMap;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use blocksense_data_providers_sdk::price_data::types::{PricePair, ProvidersSymbols};
use blocksense_sdk::oracle::Settings;

/* Feed configuration data related types */

#[derive(Debug, Serialize, Deserialize)]
pub struct ProvidersConfig {
    pub providers: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FeedConfigData {
    pub pair: PricePair,
    pub arguments: ProvidersConfig,
}

/*  Oracle resource data related types */

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourcePairData {
    pub pair: PricePair,
    pub id: String,
}

#[derive(Debug)]
pub struct ResourceData {
    pub pairs: Vec<ResourcePairData>,
    pub symbols: ProvidersSymbols,
}

//TODO: Consider moving this type to blocksense-sdk
pub type Capabilities = HashMap<String, String>;

pub fn get_capabilities_from_settings(settings: &Settings) -> Capabilities {
    settings
        .capabilities
        .iter()
        .map(|cap| (cap.id.to_string(), cap.data.to_string()))
        .collect()
}

//TODO: Consider moving this function to blocksense-sdk
pub fn get_api_keys(capabilities: &Capabilities, keys: &[&str]) -> Option<HashMap<String, String>> {
    keys.iter()
        .map(|&key| {
            capabilities
                .get(key)
                .map(|value| (key.to_string(), value.clone()))
        })
        .collect()
}

pub fn get_resources_from_settings(settings: &Settings) -> Result<ResourceData> {
    let mut feeds_data = Vec::new();
    let mut providers_symbols: ProvidersSymbols = HashMap::new();

    for feed_setting in &settings.data_feeds {
        let feed_config_data: FeedConfigData =
            serde_json::from_str(&feed_setting.data).context("Couldn't parse data feed")?;

        let base = &feed_config_data.pair.base;
        let quote = &feed_config_data.pair.quote;
        let symbol = format!("{base}:{quote}");

        feeds_data.push(ResourcePairData {
            pair: feed_config_data.pair.clone(),
            id: feed_setting.id.clone(),
        });

        if let Some(providers) = &feed_config_data.arguments.providers {
            for provider in providers {
                let symbols = providers_symbols.entry(provider.clone()).or_default();

                if !symbols.contains(&symbol) {
                    symbols.push(symbol.clone());
                }
            }
        }
    }

    Ok(ResourceData {
        pairs: feeds_data,
        symbols: providers_symbols,
    })
}
