mod common;
mod exchanges;
mod fetch_prices;
mod http;
mod traits;
mod vwap;

use anyhow::{Context, Result};
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};
use common::{ExchangeName, ExchangesSymbols, ResourcePairData};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fmt::Write,
};

use crate::common::{ResourceData, TradingPair, TradingPairToResults};
use fetch_prices::fetch_all_prices;

//TODO(adikov): Refacotr:
//1. Move all specific exchange logic to separate files.
//2. Move URLS to constants
//3. Try to minimize object cloning.

type ExchangeData = HashMap<ExchangeName, HashMap<String, Vec<String>>>;

#[derive(Serialize, Deserialize, Debug)]
struct ExchangesData {
    exchanges: Option<ExchangeData>,
}

#[derive(Serialize, Deserialize, Debug)]
struct Data {
    pub pair: TradingPair,
    pub arguments: ExchangesData,
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    println!("Starting oracle component");

    let resources = get_resources_from_settings(&settings)?;

    let results = fetch_all_prices(&resources).await?;
    print_results(&resources.pairs, &results);

    let payload = process_results(results)?;
    println!("Final Payload - {:?}", payload.values);

    Ok(payload)
}

fn process_results(results: TradingPairToResults) -> Result<Payload> {
    let mut payload = Payload::new();
    for (feed_id, results) in results.into_iter() {
        let price_points = results.exchanges_data.values();

        payload.values.push(match vwap::compute_vwap(price_points) {
            Ok(price) => DataFeedResult {
                id: feed_id,
                value: DataFeedResultValue::Numerical(price),
            },
            Err(err) => DataFeedResult {
                id: feed_id,
                value: DataFeedResultValue::Error(err.to_string()),
            },
        });
    }

    Ok(payload)
}

fn get_resources_from_settings(settings: &Settings) -> Result<ResourceData> {
    let mut price_feeds = Vec::new();
    let mut exchanges_symbols: ExchangesSymbols = HashMap::new();

    for feed_setting in &settings.data_feeds {
        let feed_config =
            serde_json::from_str::<Data>(&feed_setting.data).context("Couldn't parse data feed")?;

        if let Some(exchanges) = feed_config.arguments.exchanges {
            for (exchange, symbols) in exchanges {
                let entry = exchanges_symbols.entry(exchange).or_insert_with(Vec::new);
                let mut seen_symbols = entry.iter().cloned().collect::<HashSet<_>>();

                for symbol in symbols.values().cloned().flatten() {
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

fn print_results(resources: &[ResourcePairData], results: &TradingPairToResults) {
    let (mut missing_str, mut found_str) = resources.iter().fold(
        (String::new(), String::new()),
        |(mut missing, mut found), res| {
            if let Some(res_list) = results.get(&res.id) {
                let _ = write!(found, "({}-{}),", res.id, res_list.exchanges_data.len());
            } else {
                let _ = write!(
                    missing,
                    "({}-{}/{}),",
                    res.id, res.pair.base, res.pair.quote
                );
            }
            (missing, found)
        },
    );

    // Replace last comma with closing bracket, or just insert "[]" if empty
    if !missing_str.is_empty() {
        missing_str.pop(); // Remove last comma
    }
    if !found_str.is_empty() {
        found_str.pop(); // Remove last comma
    }

    println!("missing ids(id-symbol): [{}]", missing_str);
    println!("(id-exchange_count): [{}]", found_str);
}
