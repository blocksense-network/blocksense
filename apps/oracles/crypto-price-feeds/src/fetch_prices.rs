use anyhow::Result;

use std::time::Instant;
use std::{collections::HashMap, future::Future};

use futures::stream::{FuturesUnordered, StreamExt};

use crate::{
    binance::BinancePriceFetcher,
    bitfinex::BitfinexPriceFetcher,
    bitget::BitgetFetcher,
    common::{fill_results, load_exchange_symbols, PricesFetcher, ResourceData, ResourceResult},
    okx::OKXPriceFetcher,
};

async fn try_tag_future<T>(
    tag: &str,
    future: impl Future<Output = Result<T>>,
) -> Result<(&str, T)> {
    Ok((tag, future.await?))
}

pub async fn fetch_all_prices(
    resources: &[ResourceData],
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let start = Instant::now();

    let symbols = load_exchange_symbols(resources).await?;

    let tagged_fetchers: &[(&str, Box<dyn PricesFetcher>)] = &[
        ("OKX", Box::new(OKXPriceFetcher::new(&symbols.okx))),
        ("Binance", Box::new(BinancePriceFetcher {})),
        ("Bitget", Box::new(BitgetFetcher {})),
        ("Bitfinex", Box::new(BitfinexPriceFetcher)),
    ];

    let mut futures_set = FuturesUnordered::from_iter(
        tagged_fetchers
            .iter()
            .map(|(exchange_id, fetcher)| try_tag_future(exchange_id, fetcher.fetch())),
    );

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
