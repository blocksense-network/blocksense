mod common;
mod exchanges;
mod fetch_prices;

use anyhow::{Context, Result};
use blocksense_data_providers_sdk::price_data::wap::vwap::compute_vwap;
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};
use common::{ExchangeName, ExchangesSymbols, ResourcePairData};
use itertools::Itertools;
use prettytable::{format, Cell, Row, Table};
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
    let payload = process_results(&results)?;

    print_results(&resources.pairs, &results, &payload);

    Ok(payload)
}

fn process_results(results: &TradingPairToResults) -> Result<Payload> {
    let mut payload = Payload::new();
    for (feed_id, results) in results.iter() {
        let price_points = results.exchanges_data.values();

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
    let mut exchanges_symbols: ExchangesSymbols = HashMap::new();

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

struct ResultInfo {
    pub id: i64,
    pub name: String,
    pub value: String,
    pub exchanges: Vec<String>,
}

fn print_results(
    resources: &[ResourcePairData],
    results: &TradingPairToResults,
    payload: &Payload,
) {
    let mut results_info: Vec<ResultInfo> = Vec::new();
    let mut pairs_with_missing_exchange_data: String = String::new();
    let mut pairs_with_missing_exchange_data_count = 0;
    let mut missing_prices: String = String::new();
    let mut missing_prices_count = 0;

    for resurce in resources.iter() {
        if results.get(&resurce.id).is_some() {
            let exchanges = results
                .get(&resurce.id)
                .map(|res| {
                    res.exchanges_data
                        .keys()
                        .map(|x| x.split(' ').next().unwrap().to_string())
                        .unique()
                        .collect()
                })
                .unwrap_or_default();

            let value = match payload
                .values
                .iter()
                .find(|x| x.id == resurce.id)
                .unwrap()
                .value
                .clone()
            {
                DataFeedResultValue::Numerical(num) => format!("{num:.8}"),
                _ => {
                    missing_prices_count += 1;
                    write!(
                        missing_prices,
                        "{{ {}: {} / {}, exchanges: {:?} }},",
                        resurce.id, resurce.pair.base, resurce.pair.quote, exchanges
                    )
                    .unwrap();
                    "-".to_string()
                }
            };

            results_info.push(ResultInfo {
                id: resurce.id.parse().unwrap(),
                name: format!("{} / {}", resurce.pair.base, resurce.pair.quote),
                value,
                exchanges,
            });
        } else {
            pairs_with_missing_exchange_data_count += 1;
            write!(
                pairs_with_missing_exchange_data,
                "{{ {}: {} / {} }},",
                resurce.id, resurce.pair.base, resurce.pair.quote
            )
            .unwrap();
        }
    }

    results_info.sort_by(|a, b| a.id.cmp(&b.id));

    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);

    table.set_titles(Row::new(vec![
        Cell::new("ID").style_spec("bc"),
        Cell::new("Name").style_spec("bc"),
        Cell::new("Value").style_spec("bc"),
        Cell::new("Exchanges").style_spec("bc"),
    ]));

    for data in results_info {
        table.add_row(Row::new(vec![
            Cell::new(&data.id.to_string()).style_spec("r"),
            Cell::new(&data.name).style_spec("r"),
            Cell::new(&data.value).style_spec("r"),
            Cell::new(&data.exchanges.len().to_string()).style_spec("r"),
        ]));
    }

    println!("\n{pairs_with_missing_exchange_data_count} Pairs with no exchange data:");
    println!("[{pairs_with_missing_exchange_data}]");

    println!("\n{missing_prices_count} Pairs with missing price / volume data from exchange:");
    println!("[{missing_prices}]");

    println!("\nResults:");
    table.printstd();
}
