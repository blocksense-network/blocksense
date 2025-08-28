use std::time::Instant;

use anyhow::Result;
use futures::stream::StreamExt;
use futures::Stream;
use tracing::{info, warn};

use crate::price_data::{traits::prices_fetcher::PairPriceData, types::ProviderPriceData};

pub async fn fetch_all_prices<S>(mut futures_set: S) -> Vec<ProviderPriceData>
where
    S: Stream<Item = (&'static str, Result<PairPriceData>)> + Unpin,
{
    let mut all_fetched_prices: Vec<ProviderPriceData> = Vec::new();
    let before_fetch = Instant::now();

    // Process results as they complete
    while let Some((exchange_id, result)) = futures_set.next().await {
        match result {
            Ok(prices) => {
                let time_taken = before_fetch.elapsed();
                info!("ℹ️  Successfully fetched prices from {exchange_id} in {time_taken:?}");
                let prices_per_exchange = ProviderPriceData {
                    name: exchange_id.to_owned(),
                    data: prices,
                };
                all_fetched_prices.push(prices_per_exchange);
            }
            Err(err) => warn!("❌ Error fetching prices from {exchange_id}: {err:?}"),
        }
    }

    info!("🕛 All prices fetched in {:?}", before_fetch.elapsed());

    all_fetched_prices
}
