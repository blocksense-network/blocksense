use std::time::Instant;

use anyhow::Result;
use futures::stream::{FuturesUnordered, StreamExt};
use serde::{Deserialize, Serialize};

use blocksense_data_providers_sdk::price_data::traits::prices_fetcher::{fetch, TradingPairSymbol};
use blocksense_data_providers_sdk::price_data::types::{
    PairsToResults, ProviderPriceData, ProvidersSymbols,
};

use crate::{
    common::{ResourceData, ResourcePairData},
    exchanges::{
        binance::BinancePriceFetcher, binance_us::BinanceUsPriceFetcher,
        bitfinex::BitfinexPriceFetcher, bitget::BitgetPriceFetcher, bybit::BybitPriceFetcher,
        coinbase::CoinbasePriceFetcher, crypto_com_exchange::CryptoComPriceFetcher,
        gate_io::GateIoPriceFetcher, gemini::GeminiPriceFetcher, kraken::KrakenPriceFetcher,
        kucoin::KuCoinPriceFetcher, mexc::MEXCPriceFetcher, okx::OKXPriceFetcher,
        upbit::UpBitPriceFetcher,
    },
};

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SymbolsData {
    pub binance_us: Vec<TradingPairSymbol>,
    pub binance: Vec<TradingPairSymbol>,
    pub bitfinex: Vec<TradingPairSymbol>,
    pub coinbase: Vec<TradingPairSymbol>,
    pub gemini: Vec<TradingPairSymbol>,
    pub upbit: Vec<TradingPairSymbol>,
}

impl SymbolsData {
    pub fn from_resources(exchanges_symbols: &ProvidersSymbols) -> Result<Self> {
        Ok(Self {
            binance_us: exchanges_symbols
                .get("BinanceUS")
                .cloned()
                .unwrap_or_default(),
            binance: exchanges_symbols
                .get("Binance")
                .cloned()
                .unwrap_or_default(),
            bitfinex: exchanges_symbols
                .get("Bitfinex")
                .cloned()
                .unwrap_or_default(),
            coinbase: exchanges_symbols
                .get("Coinbase")
                .cloned()
                .unwrap_or_default(),
            gemini: exchanges_symbols.get("Gemini").cloned().unwrap_or_default(),
            upbit: exchanges_symbols.get("Upbit").cloned().unwrap_or_default(),
        })
    }
}

pub async fn fetch_all_prices(resources: &ResourceData) -> Result<PairsToResults> {
    let symbols = SymbolsData::from_resources(&resources.symbols)?;

    let mut futures_set = FuturesUnordered::from_iter([
        fetch::<BinancePriceFetcher>(&symbols.binance, None),
        fetch::<BinanceUsPriceFetcher>(&symbols.binance_us, None),
        fetch::<BitfinexPriceFetcher>(&symbols.bitfinex, None),
        fetch::<BitgetPriceFetcher>(&[], None),
        fetch::<BybitPriceFetcher>(&[], None),
        fetch::<CoinbasePriceFetcher>(&symbols.coinbase, None),
        fetch::<CryptoComPriceFetcher>(&[], None),
        fetch::<GateIoPriceFetcher>(&[], None),
        fetch::<GeminiPriceFetcher>(&symbols.gemini, None),
        fetch::<KrakenPriceFetcher>(&[], None),
        fetch::<KuCoinPriceFetcher>(&[], None),
        fetch::<MEXCPriceFetcher>(&[], None),
        fetch::<OKXPriceFetcher>(&[], None),
        fetch::<UpBitPriceFetcher>(&symbols.upbit, None),
    ]);

    let before_fetch = Instant::now();
    let mut results = PairsToResults::new();

    // Process results as they complete
    while let Some((exchange_id, result)) = futures_set.next().await {
        match result {
            Ok(prices) => {
                let time_taken = before_fetch.elapsed();
                println!("ℹ️  Successfully fetched prices from {exchange_id} in {time_taken:?}",);
                let prices_per_exchange = ProviderPriceData {
                    name: exchange_id.to_owned(),
                    data: prices,
                };
                fill_results(&resources.pairs, prices_per_exchange, &mut results);
            }
            Err(err) => println!("❌ Error fetching prices from {exchange_id}: {err:?}"),
        }
    }

    println!("🕛 All prices fetched in {:?}", before_fetch.elapsed());

    Ok(results)
}

fn fill_results(
    resources: &[ResourcePairData],
    prices_per_exchange: ProviderPriceData,
    results: &mut PairsToResults,
) {
    for resource in resources {
        let quote = [resource.pair.quote.as_str()];
        let quote_alternatives = get_alternative_quotes_for_quote(&resource.pair.quote);
        let quote_variants = quote.iter().chain(&quote_alternatives);

        let trading_pair = format!("{} / {}", resource.pair.base, resource.pair.quote);

        let res = results.entry(resource.id.clone()).or_default();
        res.symbol = trading_pair.clone();

        for quote in quote_variants {
            let symbol = format!(
                "{}{}",
                resource.pair.base.to_uppercase(),
                quote.to_uppercase()
            );
            if let Some(price_point) = prices_per_exchange.data.get(&symbol) {
                res.providers_data.insert(
                    format!("{} {} price", prices_per_exchange.name, quote),
                    price_point.clone(),
                );
            }
        }

        if res.providers_data.is_empty() {
            results.remove(&resource.id);
        }
    }
}

fn get_alternative_quotes_for_quote(quote: &str) -> Vec<&str> {
    if quote == "USD" {
        vec!["USDT", "USDC"]
    } else {
        Vec::new()
    }
}
