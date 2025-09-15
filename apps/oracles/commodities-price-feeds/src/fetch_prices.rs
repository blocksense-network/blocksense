use anyhow::Result;
use futures::stream::FuturesUnordered;
use serde::{Deserialize, Serialize};

use blocksense_data_providers_sdk::price_data::{
    fetchers::{
        fetch::fetch_all_prices,
        metals::metals_api::MetalsApiPriceFetcher,
    },
    traits::prices_fetcher::{fetch, TradingPairSymbol},
    types::{PairsToResults, ProviderPriceData, ProvidersSymbols},
};

use blocksense_sdk::oracle::{get_api_keys, Capabilities};
use crate::domain::{ResourceData, ResourcePairData};

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SymbolsData {
    pub metals_api: Vec<TradingPairSymbol>,
}

impl SymbolsData {
    pub fn from_resources(providers_symbols: &ProvidersSymbols) -> Result<Self> {
        Ok(Self {
            metals_api: providers_symbols
                .get("MetalsAPI")
                .cloned()
                .unwrap_or_default(),
        })
    }
}

pub async fn get_prices(
    resources: &ResourceData,
    capabilities: &Capabilities,
    timeout_secs: u64,
) -> Result<PairsToResults> {
    let symbols = SymbolsData::from_resources(&resources.symbols)?;

    let futures_set = FuturesUnordered::from_iter([
        fetch::<MetalsApiPriceFetcher>(
            &symbols.metals_api,
            get_api_keys(capabilities, &["METALS_API_KEY"]),
            timeout_secs,
        ),
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
        let pair = format!("{}{}", resource.pair.base, resource.pair.quote);

        let res = results.entry(resource.id.clone()).or_default();
        res.symbol = pair.clone();

        if let Some(price_point) = prices_per_provider.data.get(&pair) {
            res.providers_data
                .insert(provider_name.clone(), price_point.clone());
        }
        if res.providers_data.is_empty() {
            results.remove(&resource.id);
        }
    }
}
