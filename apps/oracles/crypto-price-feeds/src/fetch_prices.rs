use anyhow::Result;

use std::collections::HashMap;
use std::time::Instant;

use futures::stream::{FuturesUnordered, StreamExt};
use std::future::Future;
use std::pin::Pin;

use crate::binance::get_binance_prices;
use crate::binance_us::get_binance_us_prices;
use crate::bitfinex::get_bitfinex_prices;
use crate::bitget::get_bitget_prices;
use crate::bybit::get_bybit_prices;
use crate::coinbase::get_coinbase_prices;
use crate::common::{fill_results, PairPriceData, ResourceData, ResourceResult};
use crate::crypto_com_exchange::get_crypto_com_exchange_prices;
use crate::gate_io::get_gate_io_prices;
use crate::gemini::get_gemini_prices;
use crate::kraken::get_kraken_prices;
use crate::kucoin::get_kucoin_prices;
use crate::mexc::get_mexc_prices;
use crate::okx::get_okx_prices;
use crate::upbit::get_upbit_prices;

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
    let mut futures = FuturesUnordered::<BoxedFuture>::new();
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
