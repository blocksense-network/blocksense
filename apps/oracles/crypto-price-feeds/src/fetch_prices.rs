use anyhow::Result;

use std::collections::HashMap;
use std::time::Instant;

use futures::{
    future::LocalBoxFuture,
    stream::{FuturesUnordered, StreamExt},
};

use crate::common::{PairPriceData, ResourceData, ResourceResult, USD_SYMBOLS};

pub async fn fetch_all_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let mut futures = FuturesUnordered::<LocalBoxFuture<Result<(String, PairPriceData)>>>::new();
    let start = Instant::now();

    // Process results as they complete
    while let Some(result) = futures.next().await {
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
