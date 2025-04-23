use anyhow::Result;
use serde::{Deserialize, Serialize};

use std::time::Instant;

use futures::stream::{FuturesUnordered, StreamExt};

use blocksense_sdk::traits::prices_fetcher::{fetch, TradingPairSymbol};

use crate::types::{
    PairToResults, ProviderPriceData, ProvidersSymbols, ResourceData, ResourcePairData,
};

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SymbolsData {}

impl SymbolsData {
    pub fn from_resources(_providers_symbols: &ProvidersSymbols) -> Result<Self> {
        Ok(Self {})
    }
}

/*TODO:(EmilIvanichkovv):
    The `fetch_all_prices` function is very similar to the one we use in `crypto-price-feeds` oracle.
    It should be moved to blocksense-sdk
*/
pub async fn fetch_all_prices(resources: &ResourceData) -> Result<PairToResults> {
    let symbols = SymbolsData::from_resources(&resources.symbols)?;

    let mut futures_set = FuturesUnordered::from_iter([]);

    let before_fetch = Instant::now();
    let mut results = PairToResults::new();

    // Process results as they complete
    while let Some((provider_id, result)) = futures_set.next().await {
        match result {
            Ok(prices) => {
                let time_taken = before_fetch.elapsed();
                println!("ℹ️  Successfully fetched prices from {provider_id} in {time_taken:?}",);
                let prices_per_provider = ProviderPriceData {
                    name: "demo_provider".to_string(),
                    data: prices,
                };
                fill_results(&resources.pairs, prices_per_provider, &mut results);
            }
            Err(err) => println!("❌ Error fetching prices from {provider_id}: {err:?}"),
        }
    }

    println!("🕛 All prices fetched in {:?}", before_fetch.elapsed());

    Ok(results)
}

fn fill_results(
    resources: &[ResourcePairData],
    prices_per_provider: ProviderPriceData,
    results: &mut PairToResults,
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
