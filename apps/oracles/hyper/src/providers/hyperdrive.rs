use std::collections::{BTreeMap, HashMap};

use anyhow::Result;
use blocksense_sdk::http::http_get_json;
use futures::{stream, StreamExt};
use serde::Deserialize;
use serde_this_or_that::as_f64;

use crate::domain::{FeedConfig, Rates, ReserveInfo};

pub async fn fetch_borrow_rates_from_hyperdrive(feeds_config: &Vec<FeedConfig>) -> Result<Rates> {
    let mut borrow_rates: Rates = HashMap::new();

    // Collect only HyperDrive feeds, grouped by market_id, but store minimal info
    // (avoid capturing &FeedConfig across async boundaries).
    // Vec<(base_symbol, feed_id)>
    let mut by_market: BTreeMap<String, Vec<(String, String)>> = BTreeMap::new();
    for feed in feeds_config
        .iter()
        .filter(|f| f.arguments.marketplace == "HyperDrive")
    {
        match &feed.arguments.market_id {
            Some(mid) if !mid.is_empty() => {
                by_market
                    .entry(mid.clone())
                    .or_default()
                    .push((feed.pair.base.clone(), feed.feed_id.to_string()));
            }
            _ => {
                eprintln!(
                    "Feed {} missing required HyperDrive market_id. Skipping.",
                    feed.feed_id
                );
            }
        }
    }

    // Build a stream of async fetches and run them with bounded concurrency.
    let fetches = by_market
        .into_iter()
        .map(|(market_id, feeds)| async move {
            // Fetch with error boundary; do not fail the whole oracle
            match fetch_rates_for_market(&market_id).await {
                Ok(resp) => Some((market_id, feeds, resp)),
                Err(err) => {
                    eprintln!(
                        "HyperDrive fetch failed for market_id={}: {}. Skipping feeds referencing this market.",
                        market_id, err
                    );
                    None
                }
            }
        });

    const MAX_CONCURRENCY: usize = 32;
    let mut stream = stream::iter(fetches).buffer_unordered(MAX_CONCURRENCY);

    while let Some(result) = stream.next().await {
        let Some((market_id, feeds, resp)) = result else {
            continue;
        };

        if resp.data.is_empty() {
            eprintln!(
                "HyperDrive returned empty data for market_id={}. Skipping.",
                market_id
            );
            continue;
        }

        // If multiple rows are possible, pick the first/newest per API contract.
        let row = &resp.data[0];

        // Assuming borrow_rate is 1e18-scaled; convert to f64 APR.
        // Avoid integer division by using f64 scaling.
        let borrow_rate_apr: f64 = (row.borrow_rate as f64) / 1e18f64;

        for (base_symbol, _feed_id) in feeds {
            borrow_rates.insert(
                base_symbol,
                ReserveInfo {
                    underlying_asset: None,
                    borrow_rate: borrow_rate_apr,
                },
            );
        }
    }

    Ok(borrow_rates)
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct HyperdriveRateData {
    pub chain_id: u32,
    pub market_id: u32,
    #[serde(deserialize_with = "as_f64")]
    pub borrow_rate: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct HyperdriveRatesResponse {
    pub data: Vec<HyperdriveRateData>,
}

pub async fn fetch_rates_for_market(market_id: &str) -> Result<HyperdriveRatesResponse> {
    let url = format!("https://api.hyperdrive.fi/markets/999/{market_id}/rates");
    let response = http_get_json::<HyperdriveRatesResponse>(&url, None, None).await;

    response
}
