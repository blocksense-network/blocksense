use std::collections::{BTreeMap, HashMap};

use anyhow::Result;
use blocksense_sdk::http::http_get_json;
use futures::{future::join_all};
use serde::Deserialize;
use serde_this_or_that::as_f64;

use crate::domain::{BorrowRateInfo, FeedConfig, RatesPerFeed};

pub async fn fetch_borrow_rates_from_hyperdrive(
    hyperdrive_feeds: Option<&[FeedConfig]>,
) -> Result<RatesPerFeed> {
    let mut borrow_rates: RatesPerFeed = HashMap::new();

    let Some(feeds) = hyperdrive_feeds else {
        return Ok(borrow_rates);
    };

    let mut by_market: BTreeMap<String, Vec<(String, u128)>> = BTreeMap::new();

    for feed in feeds {
        match &feed.arguments.market_id {
            Some(mid) if !mid.is_empty() => {
                by_market
                    .entry(mid.clone())
                    .or_default()
                    .push((feed.pair.base.clone(), feed.feed_id));
            }
            _ => {
                eprintln!(
                    "Feed {} missing required HyperDrive market_id. Skipping.",
                    feed.feed_id
                );
            }
        }
    }

    let fetches = by_market
        .into_iter()
        .map(|(market_id, feeds)| async move {
            match fetch_rates_for_market(&market_id).await {
                Ok(resp) => Some((feeds, resp)),
                Err(err) => {
                    eprintln!(
                        "HyperDrive fetch failed for market_id={}: {}. Skipping feeds referencing this market.",
                        market_id, err
                    );
                    None
                }
            }
        })
        .collect::<Vec<_>>();

    let results = join_all(fetches).await;

    for result in results {
        let Some((feeds, resp)) = result else {
            continue;
        };

        let Some(row) = resp.data.first() else {
            eprintln!("HyperDrive returned empty data. Skipping.");
            continue;
        };
        let borrow_rate_apr = (row.borrow_rate as f64) / 1e18;

        for (base_symbol, feed_id) in feeds {
            borrow_rates.insert(
                feed_id,
                BorrowRateInfo {
                    asset: base_symbol,
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
    let response = http_get_json::<HyperdriveRatesResponse>(&url, None, None, None).await;

    response
}
