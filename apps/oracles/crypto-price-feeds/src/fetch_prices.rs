use anyhow::Result;

use std::time::Instant;
use std::{collections::HashMap, future::Future};

use futures::stream::{FuturesUnordered, StreamExt};

use crate::{
    common::{PairPriceData, ResourceData, ResourceResult, TradingPairToResults, USD_SYMBOLS},
    exchanges::{
        binance::BinancePriceFetcher, binance_us::BinanceUsPriceFetcher,
        bitfinex::BitfinexPriceFetcher, bitget::BitgetPriceFetcher, bybit::BybitPriceFetcher,
        coinbase::CoinbasePriceFetcher, okx::OKXPriceFetcher,
    },
    symbols_cache::load_exchange_symbols,
    traits::prices_fetcher::PricesFetcher,
};

pub async fn fetch_all_prices(resources: &[ResourceData]) -> Result<TradingPairToResults> {
    let symbols = load_exchange_symbols(resources).await?;

    let tagged_fetchers: &[(&str, Box<dyn PricesFetcher>)] = &[
        ("Binance", Box::new(BinancePriceFetcher)),
        ("Binance US", Box::new(BinanceUsPriceFetcher)),
        ("Bitfinex", Box::new(BitfinexPriceFetcher)),
        ("Bitget", Box::new(BitgetPriceFetcher)),
        ("Bybit", Box::new(BybitPriceFetcher)),
        ("Coinbase", Box::new(CoinbasePriceFetcher)),
        ("OKX", Box::new(OKXPriceFetcher::new(&symbols.okx))),
    ];

    let mut futures_set = FuturesUnordered::from_iter(
        tagged_fetchers
            .iter()
            .map(|(exchange_id, fetcher)| try_tag_future(exchange_id, fetcher.fetch())),
    );

    let before_fetch = Instant::now();
    let mut results = HashMap::new();

    // Process results as they complete
    while let Some(result) = futures_set.next().await {
        match result {
            Ok((exchange_id, prices)) => {
                let time_taken = before_fetch.elapsed();
                println!("ℹ️  Successfully fetched prices from {exchange_id} in {time_taken:?}",);

                fill_results(resources, prices, &mut results).unwrap_or_else(|err| {
                    println!("❌ Error filling results for {exchange_id}: {err:?}");
                });
            }
            Err(err) => println!("❌ Error processing future: {err:?}"),
        }
    }

    println!("🕛 All prices fetched in {:?}", before_fetch.elapsed());

    Ok(results)
}

fn fill_results(
    resources: &[ResourceData],
    prices: PairPriceData,
    results: &mut TradingPairToResults,
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
