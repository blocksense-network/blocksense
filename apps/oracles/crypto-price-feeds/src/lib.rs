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
use blocksense_registry::config::FeedConfig;
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

    let resources = get_resources_from_settings(&settings)?;

    let results = fetch_all_prices(&resources).await?;
    print_results(&resources, &results);

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

fn get_resources_from_settings(settings: &Settings) -> Result<Vec<ResourceData>> {
    let mut price_feeds = Vec::new();

    for feed_setting in &settings.data_feeds {
        let feed_config = serde_json::from_str::<FeedConfig>(&feed_setting.data)
            .context("Couldn't parse data feed")?;

        if feed_config.feed_type == "price-feed" {
            price_feeds.push(ResourceData {
                symbol: feed_config.additional_feed_info.pair.base,
                id: feed_config.id.to_string(),
            });
        }
    }

    Ok(price_feeds)
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
