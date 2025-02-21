use anyhow::Result;

use std::collections::HashMap;
use std::time::Instant;

use std::future::Future;
use std::pin::Pin;

use futures::{
    future::LocalBoxFuture,
    stream::{FuturesUnordered, StreamExt},
};

use crate::common::{PairPriceData, ResourceData, ResourceResult, USD_SYMBOLS};

use crate::exchanges::binance::get_binance_prices;
use crate::exchanges::binance_us::get_binance_us_prices;
use crate::exchanges::bitfinex::get_bitfinex_prices;
use crate::exchanges::bitget::get_bitget_prices;
use crate::exchanges::bybit::get_bybit_prices;
use crate::exchanges::coinbase::get_coinbase_prices;
use crate::exchanges::crypto_com_exchange::get_crypto_com_exchange_prices;
use crate::exchanges::gate_io::get_gate_io_prices;
use crate::exchanges::gemini::get_gemini_prices;
use crate::exchanges::kraken::get_kraken_prices;
use crate::exchanges::kucoin::get_kucoin_prices;
use crate::exchanges::mexc::get_mexc_prices;
use crate::exchanges::okx::get_okx_prices;
use crate::exchanges::upbit::get_upbit_prices;

// Define boxed future type that includes the exchange name
type BoxedFuture = Pin<Box<dyn Future<Output = Result<(String, PairPriceData)>>>>;

// Helper function to wrap each async call with its exchange name
fn exchange_future<F>(exchange_name: &'static str, fut: F) -> BoxedFuture
where
    F: Future<Output = Result<PairPriceData>> + 'static,
{
    Box::pin(async move {
        let prices = fut.await?;
        Ok((exchange_name.to_string(), prices))
    })
}

pub async fn fetch_all_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let mut futures = FuturesUnordered::<LocalBoxFuture<Result<(String, PairPriceData)>>>::new();
    let start = Instant::now();

    // Push exchange futures into FuturesUnordered
    futures.push(exchange_future("Binance US", get_binance_us_prices()));
    futures.push(exchange_future("Binance", get_binance_prices()));
    futures.push(exchange_future("Bitfinex", get_bitfinex_prices()));
    futures.push(exchange_future("Bitget", get_bitget_prices()));
    futures.push(exchange_future("Bybit", get_bybit_prices()));
    futures.push(exchange_future("Coinbase", get_coinbase_prices()));
    futures.push(exchange_future(
        "Crypto.com",
        get_crypto_com_exchange_prices(),
    ));
    futures.push(exchange_future("Gate.io", get_gate_io_prices()));
    futures.push(exchange_future("Gemini", get_gemini_prices()));
    futures.push(exchange_future("Kraken", get_kraken_prices()));
    futures.push(exchange_future("KuCoin", get_kucoin_prices()));
    futures.push(exchange_future("MEXC", get_mexc_prices()));
    futures.push(exchange_future("OKX", get_okx_prices()));
    futures.push(exchange_future("Upbit", get_upbit_prices()));

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
