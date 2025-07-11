use anyhow::Result;
use futures::stream::FuturesUnordered;
use serde::{Deserialize, Serialize};

use blocksense_data_providers_sdk::price_data::{
    fetchers::{
        fetch::fetch_all_prices,
        stock_markets::{
            alpaca_markets::AlpacaMarketsPriceFetcher, alpha_vantage::AlphaVantagePriceFetcher,
            fmp::FMPPriceFetcher, twelvedata::TwelveDataPriceFetcher,
            yahoo_finance::YFPriceFetcher,
        },
    },
    traits::prices_fetcher::{fetch, TradingPairSymbol},
    types::{PairsToResults, ProviderPriceData, ProvidersSymbols},
};

use crate::{
    types::{Capabilities, ResourceData, ResourcePairData},
    utils::get_api_keys,
};

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SymbolsData {
    pub alpaca_markets: Vec<TradingPairSymbol>,
    pub alpha_vantage: Vec<TradingPairSymbol>,
    pub yahoo_finance: Vec<TradingPairSymbol>,
    pub twelvedata: Vec<TradingPairSymbol>,
    pub fmp: Vec<TradingPairSymbol>,
}

impl SymbolsData {
    pub fn from_resources(providers_symbols: &ProvidersSymbols) -> Result<Self> {
        Ok(Self {
            alpaca_markets: providers_symbols
                .get("AlpacaMarkets")
                .cloned()
                .unwrap_or_default(),
            alpha_vantage: providers_symbols
                .get("AlphaVantage")
                .cloned()
                .unwrap_or_default(),
            yahoo_finance: providers_symbols
                .get("YahooFinance")
                .cloned()
                .unwrap_or_default(),
            twelvedata: providers_symbols
                .get("twelvedata")
                .cloned()
                .unwrap_or_default(),
            fmp: providers_symbols.get("FMP").cloned().unwrap_or_default(),
        })
    }
}

pub async fn get_prices(
    resources: &ResourceData,
    capabilities: &Capabilities,
) -> Result<PairsToResults> {
    let symbols = SymbolsData::from_resources(&resources.symbols)?;

    let futures_set = FuturesUnordered::from_iter([
        fetch::<AlpacaMarketsPriceFetcher>(
            &symbols.alpaca_markets,
            get_api_keys(capabilities, &["APCA_API_KEY_ID", "APCA_API_SECRET_KEY"]),
        ),
        fetch::<AlphaVantagePriceFetcher>(
            &symbols.alpha_vantage,
            get_api_keys(capabilities, &["ALPHAVANTAGE_API_KEY"]),
        ),
        fetch::<YFPriceFetcher>(
            &symbols.yahoo_finance,
            get_api_keys(capabilities, &["YAHOO_FINANCE_API_KEY"]),
        ),
        fetch::<TwelveDataPriceFetcher>(
            &symbols.twelvedata,
            get_api_keys(capabilities, &["TWELVEDATA_API_KEY"]),
        ),
        fetch::<FMPPriceFetcher>(&symbols.fmp, get_api_keys(capabilities, &["FMP_API_KEY"])),
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
    prices_per_provider: ProviderPriceData,
    results: &mut PairsToResults,
) {
    let provider_name = &prices_per_provider.name.clone();
    for resource in resources {
        let symbol = &resource.pair.base;

        let res = results.entry(resource.id.clone()).or_default();
        res.symbol = symbol.clone();

        if let Some(price_point) = prices_per_provider.data.get(symbol) {
            res.providers_data
                .insert(provider_name.clone(), price_point.clone());
        }
        if res.providers_data.is_empty() {
            results.remove(&resource.id);
        }
    }
}
