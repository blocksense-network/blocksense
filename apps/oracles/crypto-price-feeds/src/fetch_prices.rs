use anyhow::Result;

use std::collections::HashMap;
use std::time::Instant;

use futures::stream::{FuturesUnordered, StreamExt};
use std::future::Future;
use std::pin::Pin;

use blocksense_sdk::spin::http::{send, Response};

use crate::binance::BinancePriceFetcher;
use crate::bitfinex::BitfinexPriceFetcher;
use crate::bitget::BitgetFetcher;
use crate::common::{fill_results, PairPriceData, ResourceData, ResourceResult, Fetcher};

// Define boxed future type that includes the exchange name
type BoxedFuture = Pin<Box<dyn Future<Output = Result<(String, PairPriceData)>>>>;

fn run_fetcher<EF>() -> Pin<Box<dyn Future<Output = Result<(String, EF::ParsedResponse)>>>>
where
    EF: Fetcher + 'static
{
    Box::pin(async move {
        let req = EF::get_request();
        let resp: Response = send(req?).await?;
        let deserialized = EF::deserialize_response(resp)?;
        let prices: EF::ParsedResponse = EF::parse_response(deserialized)?;
        Ok((EF::NAME.into(), prices))
    })
}

pub async fn fetch_all_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let mut futures = FuturesUnordered::<BoxedFuture>::new();
    let start = Instant::now();

    // Push exchange futures into FuturesUnordered
    futures.push(run_fetcher::<BinancePriceFetcher>());
    futures.push(run_fetcher::<BitfinexPriceFetcher>());
    futures.push(run_fetcher::<BitgetFetcher>());

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
