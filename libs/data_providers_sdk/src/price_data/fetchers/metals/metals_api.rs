use std::collections::{HashMap, HashSet};

use anyhow::{bail, Error, Result};
use futures::{future::LocalBoxFuture, FutureExt};
use serde::Deserialize;

use blocksense_sdk::http::http_get_json;

use crate::price_data::{
    fetchers::stock_markets::utils::print_missing_provider_price_data,
    traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher},
};

#[derive(Debug, Deserialize)]
pub struct MetalsApiResponse {
    pub success: Option<bool>,
    pub base: Option<String>,
    pub rates: HashMap<String, f64>,
}

pub struct MetalsApiPriceFetcher<'a> {
    pub symbols: &'a [String],
    api_keys: Option<HashMap<String, String>>,
}

impl<'a> PricesFetcher<'a> for MetalsApiPriceFetcher<'a> {
    const NAME: &'static str = "MetalsAPI";

    fn new(symbols: &'a [String], api_keys: Option<HashMap<String, String>>) -> Self {
        Self { symbols, api_keys }
    }

    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<Result<PairPriceData>> {
        async move {
            let api_key = self
                .api_keys
                .as_ref()
                .and_then(|map| map.get("METALS_API_KEY"))
                .ok_or_else(|| Error::msg("Missing METALS_API_KEY"))?;

            let mut bases: HashSet<&str> = HashSet::new();
            let mut metal_symbols: Vec<&str> = Vec::new();

            for raw in self.symbols.iter() {
                if let Some((metal, base)) = raw.split_once(':') {
                    bases.insert(base);
                    metal_symbols.push(metal);
                } else {
                    bail!("Symbol '{raw}' missing base (expected format METAL:BASE, e.g. XAU:USD)");
                }
            }

            if bases.is_empty() {
                bail!("No symbols provided to MetalsApiPriceFetcher");
            }
            if bases.len() > 1 {
                bail!("Multiple base currencies supplied for Metals API fetch (found: {:?}). All symbols must share the same base.", bases);
            }
            let base = bases.iter().next().unwrap();

            let symbols_param = metal_symbols.join(",");

            let response = http_get_json::<MetalsApiResponse>(
                "https://metals-api.com/api/latest",
                Some(&[
                    ("access_key", api_key.as_str()),
                    ("base", base),
                    ("symbols", symbols_param.as_str()),
                ]),
                None,
                Some(timeout_secs),
            )
            .await?;

            let mut results: PairPriceData = PairPriceData::new();
            for metal in metal_symbols {
                let maybe_price = response.rates.get(format!("{base}{metal}").as_str()).copied();
                let pair_symbol = format!("{metal}{base}");
                match maybe_price {
                    Some(price) => {
                        results.insert(pair_symbol, PricePoint { price, volume: 1.0 });
                    }
                    None => {
                        print_missing_provider_price_data(
                            Self::NAME,
                            pair_symbol,
                            maybe_price,
                            Some(1.0),
                        );
                    }
                }
            }

            Ok(results)
        }
        .boxed_local()
    }
}
