mod common;
mod exchanges;
mod fetch_prices;

use anyhow::{bail, Context, Result};
// use async_trait::async_trait;
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    // price_pair::{DataProvider, OraclePriceHelper},
    oracle_component,
};
use serde::Deserialize;
use std::collections::HashMap;

use crate::common::{ResourceData, ResourceResult};
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
    let resources = get_resources_from_settings(settings)?;

    let mut results: HashMap<String, Vec<ResourceResult>> = HashMap::new();
    fetch_all_prices(&resources, &mut results).await?;

    print_results(&resources, &results);

    let payload = process_results(results)?;
    println!("Final Payload - {:?}", payload.values);

    Ok(payload)
}

fn process_results(results: HashMap<String, Vec<ResourceResult>>) -> Result<Payload> {
    let mut payload = Payload::new();
    for (feed_id, results) in results.into_iter() {
        payload.values.push(match vwap(&results) {
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

fn print_results(resources: &Vec<ResourceData>, results: &HashMap<String, Vec<ResourceResult>>) {
    let mut missing = "[".to_string();
    for res in resources {
        if !results.contains_key(&res.id) {
            missing.push_str(&format!("({}-{}),", res.id, res.symbol).to_string());
        }
    }
    println!("missing ids(id-symbol): {}]", missing);

    let mut print = "[".to_string();
    for (id, results) in results {
        print.push_str(&format!("({}-{}),", id, results.len()).to_string());
    }
    println!("(id-echange_count): {}]", print);
}

fn vwap(results: &Vec<ResourceResult>) -> Result<f64> {
    if results.is_empty() {
        bail!("Missing results");
    }

    //TODO(adikov): Implement vwap logic here.
    // Assume a five-minute chart. The calculation is the same regardless of what intraday time frame is used.
    // 1. Find the average price the stock traded at over the first five-minute period of the day.
    //    To do this, add the high, low, and close, then divide by three.
    //    Multiply this by the volume for that period. Record the result in a spreadsheet, under column PV (price, volume).
    // 2. Divide PV by the volume for that period. This will produce the VWAP.
    // 3. To maintain the VWAP throughout the day, continue to add the PV value from each period to the prior values.
    //    Divide this total by the total volume up to that point.
    //
    //   THIS IS NOT THE PROPER IMPLEMENTATION IT IS FOR TEST PURPOSES
    let mut sum: f64 = 0.0f64;
    for res in results {
        sum += res.result.parse::<f64>()?;
    }

    Ok(sum / results.len() as f64)
}
