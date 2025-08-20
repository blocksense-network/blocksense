use std::time::Instant;

use anyhow::Result;
use futures::stream::StreamExt;
use futures::Stream;
use futures_timeout::TimeoutExt;
use std::time::Duration;

use crate::price_data::{traits::prices_fetcher::PairPriceData, types::ProviderPriceData};
pub async fn fetch_all_prices<S>(futures_set: S, interval: &Duration) -> Vec<ProviderPriceData>
where
    S: Stream<Item = (&'static str, Result<PairPriceData>)> + Unpin,
{
    let mut all_fetched_prices: Vec<ProviderPriceData> = Vec::new();
    let before_fetch = Instant::now();
    match fetch_loop_prices(futures_set, &mut all_fetched_prices, before_fetch)
        .timeout(*interval)
        .await
    {
        Ok(()) => {
            println!("🕛 All prices fetched in {:?}", before_fetch.elapsed());
        }
        Err(_e) => {
            println!("🕛 Not all prices fetched in {:?}", before_fetch.elapsed());
        }
    }
    all_fetched_prices
}

async fn fetch_loop_prices<S>(
    mut futures_set: S,
    all_fetched_prices: &mut Vec<ProviderPriceData>,
    before_fetch: Instant,
) where
    S: Stream<Item = (&'static str, Result<PairPriceData>)> + Unpin,
{
    while let Some((exchange_id, result)) = futures_set.next().await {
        match result {
            Ok(prices) => {
                let time_taken = before_fetch.elapsed();
                println!("ℹ️  Successfully fetched prices from {exchange_id} in {time_taken:?}",);
                let prices_per_exchange = ProviderPriceData {
                    name: exchange_id.to_owned(),
                    data: prices,
                };
                all_fetched_prices.push(prices_per_exchange);
            }
            Err(err) => println!("❌ Error fetching prices from {exchange_id}: {err:?}"),
        }
    }
}
