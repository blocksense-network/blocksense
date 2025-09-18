mod fetch_prices;
mod types;
mod utils;

use std::collections::HashMap;

use anyhow::{Context, Error, Result};

use tracing::{info, warn};

use blocksense_data_providers_sdk::price_data::types::{PairsToResults, ProvidersSymbols};
use blocksense_data_providers_sdk::price_data::wap::vwap::compute_vwap;
use itertools::Itertools;
use blocksense_sdk::{
    oracle::{
        get_capabilities_from_settings,
        logging::{print_price_feed_results, PriceResultsAccessor},
        DataFeedResult, DataFeedResultValue, Payload, Settings,
    },
    oracle_component,
};
use chrono::Utc;
use chrono_tz::US::Eastern;

use types::{FeedConfigData, ResourceData, ResourcePairData};

use crate::fetch_prices::get_prices;
use crate::utils::markets_are_closed;

struct ResultsView<'a>(&'a PairsToResults);

impl<'a> PriceResultsAccessor for ResultsView<'a> {
    fn has(&self, id: &str) -> bool { self.0.get(id).is_some() }
    fn provider_names(&self, id: &str) -> Vec<String> {
        self.0
            .get(id)
            .map(|res| {
                res.providers_data
                    .keys()
                    .map(|x| x.split(' ').next().unwrap_or("").to_string())
                    .unique()
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default()
    }
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    tracing_subscriber::fmt::init();

    let now_et = Utc::now().with_timezone(&Eastern);
    if markets_are_closed(now_et) {
        warn!("❌ Markets are closed. Prices can't be fetched.");
        return Err(Error::msg("Markets are closed. Prices can't be fetched."));
    }

    info!("Starting oracle component - Stock Price Feeds");

    let capabilities = get_capabilities_from_settings(&settings);
    let resources = get_resources_from_settings(&settings)?;
    let timeout_secs = settings.interval_time_in_seconds - 1;

    let results = get_prices(&resources, &capabilities, timeout_secs).await?;
    let payload = process_results(&results)?;

    let view = ResultsView(&results);
    print_price_feed_results(&resources.pairs, &view, &payload, "Providers", "provider", true);

    Ok(payload)
}

fn process_results(results: &PairsToResults) -> Result<Payload> {
    let mut payload = Payload::new();
    for (feed_id, results) in results.iter() {
        let price_points = results.providers_data.values();

        payload.values.push(match compute_vwap(price_points) {
            Ok(price) => DataFeedResult {
                id: feed_id.to_string(),
                value: DataFeedResultValue::Numerical(price),
            },
            Err(err) => DataFeedResult {
                id: feed_id.to_string(),
                value: DataFeedResultValue::Error(err.to_string()),
            },
        });
    }

    Ok(payload)
}

fn get_resources_from_settings(settings: &Settings) -> Result<ResourceData> {
    let mut feeds_data = Vec::new();
    let mut providers_symbols: ProvidersSymbols = HashMap::new();

    for feed_setting in &settings.data_feeds {
        let feed_config_data: FeedConfigData =
            serde_json::from_str(&feed_setting.data).context("Couldn't parse data feed")?;

        let base = &feed_config_data.pair.base;

        feeds_data.push(ResourcePairData {
            pair: feed_config_data.pair.clone(),
            id: feed_setting.id.clone(),
        });

        if let Some(providers) = &feed_config_data.arguments.providers {
            for provider in providers {
                let symbols = providers_symbols.entry(provider.clone()).or_default();

                if !symbols.contains(base) {
                    symbols.push(base.clone());
                }
            }
        }
    }

    Ok(ResourceData {
        pairs: feeds_data,
        symbols: providers_symbols,
    })
}
