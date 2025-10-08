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

pub async fn get_prices(resources: &ResourceData, timeout_secs: u64) -> Result<PairsToResults> {
    let symbols = SymbolsData::from_resources(&resources.all_symbols)?;

    let futures_set = FuturesUnordered::from_iter([
        fetch::<BinancePriceFetcher>(&symbols.binance, None, timeout_secs),
        fetch::<BinanceUsPriceFetcher>(&symbols.binance_us, None, timeout_secs),
        fetch::<BitfinexPriceFetcher>(&symbols.bitfinex, None, timeout_secs),
        fetch::<BitgetPriceFetcher>(&[], None, timeout_secs),
        fetch::<BybitPriceFetcher>(&[], None, timeout_secs),
        fetch::<CoinbasePriceFetcher>(&symbols.coinbase, None, timeout_secs),
        fetch::<CryptoComPriceFetcher>(&[], None, timeout_secs),
        fetch::<GateIoPriceFetcher>(&[], None, timeout_secs),
        fetch::<GeminiPriceFetcher>(&symbols.gemini, None, timeout_secs),
        fetch::<KrakenPriceFetcher>(&[], None, timeout_secs),
        fetch::<KuCoinPriceFetcher>(&[], None, timeout_secs),
        fetch::<MEXCPriceFetcher>(&[], None, timeout_secs),
        fetch::<OKXPriceFetcher>(&[], None, timeout_secs),
        fetch::<UpBitPriceFetcher>(&symbols.upbit, None, timeout_secs),
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
        let trading_pair = format!("{} / {}", resource.pair.base, resource.pair.quote);

        let provider_name = &prices_per_exchange.name;
        let feed_provider_symbols = resource
            .symbols_per_exchange
            .get(provider_name)
            .cloned()
            .unwrap_or_default();

        let res = results.entry(resource.id.clone()).or_default();
        res.symbol = trading_pair.clone();

        for symbol in feed_provider_symbols {
            if let Some(price_point) = prices_per_exchange.data.get(&symbol) {
                res.providers_data.insert(
                    format!("{} {} price", prices_per_exchange.name, symbol),
                    price_point.clone(),
                );
            }
        }

        if res.providers_data.is_empty() {
            results.remove(&resource.id);
        }
    }
}
