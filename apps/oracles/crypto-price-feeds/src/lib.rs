mod binance;
mod binance_us;
mod bitfinex;
mod bitget;
mod bybit;
mod coinbase;
mod common;
mod crypto_com_exchange;
mod fetch_prices;
mod gate_io;
mod gemini;
mod kraken;
mod kucoin;
mod mexc;
mod okx;
mod upbit;

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
pub struct CmcResource {
    pub cmc_id: String,
    pub cmc_quote: String,
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

fn process_results(results: HashMap<String, Vec<ResourceResult>>) -> Result<Payload> {
    let mut payload: Payload = Payload::new();
    for (feed_id, results) in results.iter() {
        payload.values.push(match vwap(results) {
            Ok(price) => DataFeedResult {
                id: feed_id.clone(),
                value: DataFeedResultValue::Numerical(price),
            },
            Err(err) => DataFeedResult {
                id: feed_id.clone(),
                value: DataFeedResultValue::Error(err.to_string()),
            },
        });
    }

    Ok(payload)
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

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    let mut resources: Vec<ResourceData> = vec![];
    let mut results: HashMap<String, Vec<ResourceResult>> =
        HashMap::<String, Vec<ResourceResult>>::new();
    // let mut ids: Vec<String> = vec![];
    //TODO(adikov): Make sure citrea feeds exist so that we can properly test.
    // let citrea_feeds = vec!["BTCUSD", "ETHUSD", "EURCUSD", "USDTUSD", "USDCUSD", "PAXGUSD", "TBTCUSD", "WBTCUSD", "WSTETHUSD"];
    for feed in settings.data_feeds.iter() {
        let data: CmcResource = serde_json::from_str(&feed.data)
            .context("Couldn't parse Data Feed resource properly")?;
        resources.push(ResourceData {
            symbol: data.cmc_quote.clone(),
            id: feed.id.clone(),
        });
    }

    fetch_all_prices(&resources, &mut results).await?;
    print_results(&resources, &results);

    let payload = process_results(results)?;
    println!("Final Payload - {:?}", payload.values);

    Ok(payload)
}
