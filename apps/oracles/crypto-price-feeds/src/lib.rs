mod common;
mod exchanges;
mod fetch_prices;
mod http;
mod symbols_cache;
mod traits;
mod vwap;

use anyhow::{Context, Result};
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};
use serde::Deserialize;
use std::fmt::Write;

use crate::common::{ResourceData, TradingPairToResults};
use fetch_prices::fetch_all_prices;

//TODO(adikov): Refacotr:
//1. Move all specific exchange logic to separate files.
//2. Move URLS to constants
//3. Try to minimize object cloning.

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
struct CmcResource {
    pub cmc_id: String,
    pub cmc_quote: String,
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    println!("Starting oracle component");

    let resources = get_resources_from_settings(settings)?;

    let results = fetch_all_prices(&resources).await?;
    print_results(&resources, &results);

    let payload = process_results(results)?;
    println!("Final Payload - {:?}", payload.values);

    Ok(payload)
}

fn process_results(results: TradingPairToResults) -> Result<Payload> {
    let mut payload = Payload::new();
    for (feed_id, results) in results.into_iter() {
        payload
            .values
            .push(match vwap::vwap(&results.exchanges_data) {
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

fn get_resources_from_settings(settings: Settings) -> Result<Vec<ResourceData>> {
    //TODO(adikov): Make sure citrea feeds exist so that we can properly test.
    // let citrea_feeds = vec!["BTCUSD", "ETHUSD", "EURCUSD", "USDTUSD", "USDCUSD", "PAXGUSD", "TBTCUSD", "WBTCUSD", "WSTETHUSD"];
    settings
        .data_feeds
        .into_iter()
        .map(|feed| {
            serde_json::from_str::<CmcResource>(&feed.data)
                .map(|cmc_resource| ResourceData {
                    symbol: cmc_resource.cmc_quote,
                    id: feed.id,
                })
                .context("Couldn't parse Data Feed resource properly")
        })
        .collect()
}

fn print_results(resources: &[ResourceData], results: &TradingPairToResults) {
    let (mut missing_str, mut found_str) = resources.iter().fold(
        (String::new(), String::new()),
        |(mut missing, mut found), res| {
            if let Some(res_list) = results.get(&res.id) {
                let _ = write!(found, "({}-{}),", res.id, res_list.exchanges_data.len());
            } else {
                let _ = write!(missing, "({}-{}),", res.id, res.symbol);
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
