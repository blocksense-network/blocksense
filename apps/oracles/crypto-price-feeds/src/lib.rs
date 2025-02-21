mod common;
mod exchanges;
mod fetch_prices;
mod symbols_cache;
mod traits;
mod vwap;

use anyhow::{Context, Result};
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
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

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    println!("starting oracle component");
    // let mut ids: Vec<String> = vec![];
    //TODO(adikov): Make sure citrea feeds exist so that we can properly test.
    // let citrea_feeds = vec!["BTCUSD", "ETHUSD", "EURCUSD", "USDTUSD", "USDCUSD", "PAXGUSD", "TBTCUSD", "WBTCUSD", "WSTETHUSD"];

    let resources: Vec<ResourceData> = settings
        .data_feeds
        .into_iter()
        .map(|feed| -> Result<_> {
            let cmc_resource = serde_json::from_str::<CmcResource>(&feed.data)
                .context("Couldn't parse Data Feed resource properly")?;

            Ok(ResourceData {
                symbol: cmc_resource.cmc_quote,
                id: feed.id,
            })
        })
        .collect::<Result<_>>()?;

    let mut results: HashMap<String, Vec<ResourceResult>> = HashMap::new();
    fetch_all_prices(&resources, &mut results).await?;
    print_results(&resources, &results);

    let payload = process_results(results)?;
    println!("Final Payload - {:?}", payload.values);

    Ok(payload)
}

fn process_results(results: HashMap<String, Vec<ResourceResult>>) -> Result<Payload> {
    let mut payload: Payload = Payload::new();
    for (feed_id, results) in results.into_iter() {
        payload.values.push(match vwap::vwap(&results) {
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
