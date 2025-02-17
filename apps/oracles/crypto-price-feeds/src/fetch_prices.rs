use anyhow::Result;

use std::collections::HashMap;
use std::time::Instant;

use futures::{
    future::LocalBoxFuture,
    stream::{FuturesUnordered, StreamExt},
    FutureExt,
};

use blocksense_sdk::spin::http::{send, Response};

use crate::binance::{BinancePriceFetcher, BinancePriceFetcher2};
use crate::bitfinex::BitfinexPriceFetcher;
use crate::bitget::BitgetFetcher;
use crate::common::{fill_results, Fetcher, ResourceData, ResourceResult};

fn run_fetcher<FetcherT: Fetcher>(
    fetcher: &FetcherT,
) -> LocalBoxFuture<Result<(String, FetcherT::ParsedResponse)>> {
    async {
        let req = fetcher.get_request();
        let resp: Response = send(req?).await?;
        let deserialized = FetcherT::deserialize_response(resp)?;
        let prices: FetcherT::ParsedResponse = FetcherT::parse_response(deserialized)?;
        Ok((FetcherT::NAME.into(), prices))
    }
    .boxed_local()
}

pub async fn fetch_all_prices(
    resources: &[ResourceData],
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let mut futures = FuturesUnordered::new();
    let start = Instant::now();

    // Push exchange futures into FuturesUnordered
    // futures.push(run_fetcher::<BinancePriceFetcher>());
    // futures.push(run_fetcher::<BitfinexPriceFetcher>());
    // futures.push(run_fetcher::<BitgetFetcher>());

    // let fetcher = BitfinexPriceFetcher {};
    // fetcher.get_request()
    futures.push(run_fetcher(&BinancePriceFetcher2::new(&["BTCUSD"])));
    // futures.push(run_fetcher(&BitfinexPriceFetcher {}));
    // futures.push(run_fetcher(&BitgetFetcher {}));

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
