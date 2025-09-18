mod common;
mod fetch_prices;

use std::collections::{HashMap, HashSet};

use anyhow::{Context, Result};

use serde::{Deserialize, Serialize};
use tracing::info;

use blocksense_data_providers_sdk::price_data::types::{
    PairsToResults, PricePair, ProviderName, ProvidersSymbols,
};
use blocksense_data_providers_sdk::price_data::wap::vwap::compute_vwap;
use itertools::Itertools;

use blocksense_sdk::{
    oracle::{
        logging::{print_price_feed_results, PriceResultsAccessor},
        DataFeedResult, DataFeedResultValue, Payload, Settings,
    },
    oracle_component,
};
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

    let view = ResultsView(&results);
    print_price_feed_results(&resources.pairs, &view, &payload, "Exchanges", "exchange", true);

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
    let mut exchanges_symbols: ProvidersSymbols = HashMap::new();

    for feed_setting in &settings.data_feeds {
        let feed_config =
            serde_json::from_str::<Data>(&feed_setting.data).context("Couldn't parse data feed")?;

        if let Some(exchanges) = feed_config.arguments.exchanges {
            for (exchange, symbols) in exchanges {
                let entry = exchanges_symbols.entry(exchange).or_default();
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
        });
    }

    Ok(ResourceData {
        pairs: price_feeds,
        symbols: exchanges_symbols,
    })
}
