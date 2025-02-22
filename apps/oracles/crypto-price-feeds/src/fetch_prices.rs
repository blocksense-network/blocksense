use anyhow::Result;

use std::time::Instant;
use std::{collections::HashMap, future::Future};

use futures::stream::{FuturesUnordered, StreamExt};

use crate::{
    common::{PairPriceData, ResourceData, ResourceResult, USD_SYMBOLS},
    exchanges::binance::BinancePriceFetcher,
    traits::prices_fetcher::PricesFetcher,
};

pub async fn fetch_all_prices(
    resources: &[ResourceData],
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let tagged_fetchers: &[(&str, Box<dyn PricesFetcher>)] =
        &[("Binance", Box::new(BinancePriceFetcher))];

    let mut futures_set = FuturesUnordered::from_iter(
        tagged_fetchers
            .iter()
            .map(|(exchange_id, fetcher)| try_tag_future(exchange_id, fetcher.fetch())),
    );

    let start = Instant::now();

    // Process results as they complete
    while let Some(result) = futures_set.next().await {
        match result {
            Ok((exchange_id, prices)) => {
                println!(
                    "ℹ️  Successfully fetched prices from {exchange_id} in {:?}",
                    start.elapsed()
                );
                fill_results(resources, results, prices).unwrap_or_else(|err| {
                    println!("❌ Error filling results for {exchange_id}: {err:?}");
                });
            }
            Err(err) => {
                println!("❌ Error processing future: {err:?}");
            }
        }
    }

    println!("🕛 All prices fetched in {:?}", start.elapsed());

    Ok(())
}

fn fill_results(
    resources: &[ResourceData],
    results: &mut HashMap<String, Vec<ResourceResult>>,
    prices: PairPriceData,
) -> Result<()> {
    //TODO(adikov): We need a proper way to get trade volume from Binance API.
    for resource in resources {
        // First USD pair found.
        for quote in USD_SYMBOLS {
            let trading_pair = format!("{}{}", resource.symbol, quote);
            if let Some(price) = prices.get(&trading_pair) {
                let res = results.entry(resource.id.clone()).or_default();
                res.push(ResourceResult {
                    id: resource.id.clone(),
                    symbol: resource.symbol.clone(),
                    usd_symbol: quote.to_owned(),
                    result: price.clone(),
                });
                break;
            }
        }
    }

    Ok(())
}

async fn try_tag_future<T>(
    tag: &str,
    future: impl Future<Output = Result<T>>,
) -> Result<(&str, T)> {
    Ok((tag, future.await?))
}
