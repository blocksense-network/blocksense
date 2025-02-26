use anyhow::Result;
use futures::FutureExt;

use std::time::Instant;

use futures::stream::{FuturesUnordered, StreamExt};

use crate::{
    common::{PairPriceData, ResourceData, ResourceResult, TradingPairToResults, USD_SYMBOLS},
    exchanges::{
        binance::BinancePriceFetcher, binance_us::BinanceUsPriceFetcher,
        bitfinex::BitfinexPriceFetcher, bitget::BitgetPriceFetcher, bybit::BybitPriceFetcher,
        coinbase::CoinbasePriceFetcher, crypto_com_exchange::CryptoComPriceFetcher,
        gate_io::GateIoPriceFetcher, gemini::GeminiPriceFetcher, kraken::KrakenPriceFetcher,
        kucoin::KuCoinPriceFetcher, mexc::MEXCPriceFetcher, okx::OKXPriceFetcher,
        upbit::UpBitPriceFetcher,
    },
    symbols_cache::load_exchange_symbols,
    traits::prices_fetcher::PricesFetcher,
};

use futures::future::LocalBoxFuture;

pub async fn fetch_all_prices(resources: &[ResourceData]) -> Result<TradingPairToResults> {
    let symbols = load_exchange_symbols(resources).await?;

    let mut futures_set = FuturesUnordered::from_iter([
        fetch::<BinancePriceFetcher>(&[]),
        fetch::<BinanceUsPriceFetcher>(&[]),
        fetch::<BitfinexPriceFetcher>(&[]),
        fetch::<BitgetPriceFetcher>(&[]),
        fetch::<BybitPriceFetcher>(&[]),
        fetch::<CoinbasePriceFetcher>(&[]),
        fetch::<CryptoComPriceFetcher>(&[]),
        fetch::<GateIoPriceFetcher>(&[]),
        fetch::<GeminiPriceFetcher>(&symbols.gemini),
        fetch::<KrakenPriceFetcher>(&[]),
        fetch::<KuCoinPriceFetcher>(&[]),
        fetch::<MEXCPriceFetcher>(&[]),
        fetch::<OKXPriceFetcher>(&symbols.okx),
        fetch::<UpBitPriceFetcher>(&symbols.upbit),
    ]);

    let before_fetch = Instant::now();
    let mut results = TradingPairToResults::new();

    // Process results as they complete
    while let Some((exchange_id, result)) = futures_set.next().await {
        match result {
            Ok(prices) => {
                let time_taken = before_fetch.elapsed();
                println!("ℹ️  Successfully fetched prices from {exchange_id} in {time_taken:?}",);
                fill_results(resources, prices, &mut results);
            }
            Err(err) => println!("❌ Error fetching prices from {exchange_id}: {err:?}"),
        }
    }

    println!("🕛 All prices fetched in {:?}", before_fetch.elapsed());

    Ok(results)
}

fn fill_results(
    resources: &[ResourceData],
    prices: PairPriceData,
    results: &mut TradingPairToResults,
) {
    //TODO(adikov): We need a proper way to get trade volume from Binance API.
    for resource in resources {
        // First USD pair found.
        for quote in USD_SYMBOLS {
            let trading_pair = format!("{}{}", resource.symbol, quote);
            if let Some(price_point) = prices.get(&trading_pair) {
                let res = results.entry(resource.id.clone()).or_default();
                res.push(ResourceResult {
                    id: resource.id.clone(),
                    symbol: resource.symbol.clone(),
                    usd_symbol: quote.to_owned(),
                    price: price_point.price,
                });
                break;
            }
        }
    }
}

fn fetch<'a, PF>(symbols: &'a [String]) -> LocalBoxFuture<'a, (&'static str, Result<PairPriceData>)>
where
    PF: PricesFetcher<'a>,
{
    async {
        let fetcher = PF::new(symbols);
        let res = fetcher.fetch().await;
        (PF::NAME, res)
    }
    .boxed_local()
}
