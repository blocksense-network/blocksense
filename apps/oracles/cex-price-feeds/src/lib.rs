mod common;
mod fetch_prices;
mod logging;

use std::collections::{HashMap, HashSet};

use anyhow::{Context, Result};

use serde::{Deserialize, Serialize};
use tracing::info;

use blocksense_data_providers_sdk::price_data::types::{
    PairsToResults, PricePair, ProviderName, ProvidersSymbols,
};
use blocksense_data_providers_sdk::price_data::wap::vwap::compute_vwap;

use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};

use crate::logging::print_results;
use crate::{
    common::{ResourceData, ResourcePairData},
    fetch_prices::get_prices,
};

type ExchangeData = HashMap<ProviderName, HashMap<String, Vec<String>>>;

#[derive(Serialize, Deserialize, Debug)]
struct ExchangesData {
    exchanges: Option<ExchangeData>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Data {
    pub pair: PricePair,
    pub arguments: ExchangesData,
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    tracing_subscriber::fmt::init();

    info!("Starting oracle component");

    let timeout_secs = settings.interval_time_in_seconds - 1;
    let resources = get_resources_from_settings(&settings)?;

    let results = get_prices(&resources, timeout_secs).await?;
    let payload = process_results(&results)?;

    print_results(&resources.pairs, &results, &payload);

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
    let mut price_feeds = Vec::new();
    let mut all_symbols_per_provider: ProvidersSymbols = HashMap::new();

    for feed_setting in &settings.data_feeds {
        let mut symbols_per_exchange: ProvidersSymbols = HashMap::new();

        let feed_config =
            serde_json::from_str::<Data>(&feed_setting.data).context("Couldn't parse data feed")?;

        if let Some(exchanges) = feed_config.arguments.exchanges {
            for (exchange, symbols) in exchanges {
                symbols_per_exchange.insert(
                    exchange.clone(),
                    symbols.values().flatten().cloned().collect(),
                );
                let entry = all_symbols_per_provider.entry(exchange).or_default();
                let mut seen_symbols = entry.iter().cloned().collect::<HashSet<_>>();

                for symbol in symbols.values().flatten().cloned() {
                    if !seen_symbols.contains(&symbol) {
                        entry.push(symbol.clone());
                        seen_symbols.insert(symbol);
                    }
                }
            }
        }

        price_feeds.push(ResourcePairData {
            pair: feed_config.pair,
            id: feed_setting.id.clone(),
            symbols_per_exchange,
        });
    }

    Ok(ResourceData {
        pairs: price_feeds,
        all_symbols: all_symbols_per_provider,
    })
}
