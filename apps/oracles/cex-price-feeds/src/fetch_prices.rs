use anyhow::Result;
use futures::stream::FuturesUnordered;
use serde::{Deserialize, Serialize};

use blocksense_data_providers_sdk::price_data::{
    fetchers::{
        exchanges::{
            binance::BinancePriceFetcher, binance_us::BinanceUsPriceFetcher,
            bitfinex::BitfinexPriceFetcher, bitget::BitgetPriceFetcher, bybit::BybitPriceFetcher,
            coinbase::CoinbasePriceFetcher, crypto_com_exchange::CryptoComPriceFetcher,
            gate_io::GateIoPriceFetcher, gemini::GeminiPriceFetcher, kraken::KrakenPriceFetcher,
            kucoin::KuCoinPriceFetcher, mexc::MEXCPriceFetcher, okx::OKXPriceFetcher,
            upbit::UpBitPriceFetcher,
        },
        fetch::fetch_all_prices,
    },
    traits::prices_fetcher::{fetch, TradingPairSymbol},
    types::{PairsToResults, ProviderPriceData, ProvidersSymbols},
};

use crate::common::{ResourceData, ResourcePairData};

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

pub async fn get_prices(resources: &ResourceData) -> Result<PairsToResults> {
    let symbols = SymbolsData::from_resources(&resources.symbols)?;

    let futures_set = FuturesUnordered::from_iter([
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

    let fetched_provider_prices = fetch_all_prices(futures_set).await;

    let mut final_results = PairsToResults::new();
    for price_data_for_exchange in fetched_provider_prices {
        fill_results(
            &resources.pairs,
            price_data_for_exchange,
            &mut final_results,
        );
    }
    Ok(final_results)
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
