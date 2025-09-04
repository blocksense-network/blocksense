use std::collections::HashMap;

use anyhow::{Error, Result};
use futures::{future::LocalBoxFuture, FutureExt};
use serde::Deserialize;

use blocksense_sdk::http::http_get_json;

use crate::price_data::{
    fetchers::stock_markets::utils::print_missing_provider_price_data,
    traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher},
};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceData {
    pub symbol: String,
    pub price: Option<f64>,
    pub previous_close: Option<f64>,
}

type FMPResponse = Vec<PriceData>;

pub struct FMPPriceFetcher<'a> {
    pub symbols: &'a [String],
    api_keys: Option<HashMap<String, String>>,
}

impl<'a> PricesFetcher<'a> for FMPPriceFetcher<'a> {
    const NAME: &'static str = "FMP";

    fn new(symbols: &'a [String], api_keys: Option<HashMap<String, String>>) -> Self {
        Self { symbols, api_keys }
    }

    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<Result<PairPriceData>> {
        async move {
            let api_key = self
                .api_keys
                .as_ref()
                .and_then(|map| map.get("FMP_API_KEY"))
                .ok_or_else(|| Error::msg("Missing FMP_API_KEY"))?;

            let all_symbols = self
                .symbols
                .iter()
                .map(|s| s.replace(':', ""))
                .collect::<Vec<String>>()
                .join(",");

            let response = http_get_json::<FMPResponse>(
                format!("https://financialmodelingprep.com/api/v3/quote/{all_symbols}").as_str(),
                Some(&[("apikey", api_key)]),
                None,
                Some(timeout_secs),
            )
            .await?;

            let results = response
                .into_iter()
                .filter_map(|value| {
                    let price = value.price.or(value.previous_close);
                    match price {
                        Some(price) => Some((value.symbol, PricePoint { price, volume: 1.0 })),
                        _ => {
                            print_missing_provider_price_data(
                                "FMP",
                                value.symbol,
                                price,
                                Some(1.0),
                            );
                            None
                        }
                    }
                })
                .collect::<PairPriceData>();

            Ok(results)
        }
        .boxed_local()
    }
}
