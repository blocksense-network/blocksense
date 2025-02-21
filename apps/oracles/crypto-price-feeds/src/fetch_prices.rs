use anyhow::Result;

use std::collections::HashMap;
use std::time::Instant;

use futures::stream::{FuturesUnordered, StreamExt};
use std::future::Future;
use std::pin::Pin;

use crate::common::{fill_results, PairPriceData, ResourceData, ResourceResult};

// Define boxed future type that includes the exchange name
type BoxedFuture = Pin<Box<dyn Future<Output = Result<(String, PairPriceData)>>>>;

pub async fn fetch_all_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let mut futures = FuturesUnordered::<BoxedFuture>::new();
    let start = Instant::now();

    // Process results as they complete
    while let Some(result) = futures.next().await {
        match result {
            Ok((exchange, value)) => {
                println!("ℹ️  Successfully fetched prices from {}", exchange);
                fill_results(resources, results, value).unwrap_or_else(|err| {
                    println!("❌ Error filling results for {}: {:?}", exchange, err);
                });
            }
            Err(err) => {
                println!("❌ Error processing future: {:?}", err);
            }
        }
    }
    println!("🕛 All prices fetched in {:?}", start.elapsed());

    Ok(())
}
