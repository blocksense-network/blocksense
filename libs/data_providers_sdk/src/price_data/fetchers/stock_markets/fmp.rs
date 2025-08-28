use std::collections::HashMap;

use anyhow::{Error, Result};
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;

use blocksense_sdk::http::http_get_json;

use crate::price_data::fetchers::stock_markets::utils::print_missing_network_price_data;
use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceData {
    pub symbol: String,
    pub price: Option<f64>,
    pub volume: Option<f64>,
    pub previous_close: Option<f64>,
}

type FMPResponse = Vec<PriceData>;

pub struct FMPPriceFetcher<'a> {
    pub symbols: &'a [String],
    api_keys: Option<HashMap<String, String>>,
}

impl<'a> PricesFetcher<'a> for FMPPriceFetcher<'a> {
    const NAME: &'static str = "FMP";

    fn new(symbols: &'a [String], api_key: Option<HashMap<String, String>>) -> Self {
        Self {
            symbols,
            api_keys: api_key,
        }
    }

    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<Result<PairPriceData>> {
        async move {
            let api_key = self
                .api_keys
                .as_ref()
                .and_then(|map| map.get("FMP_API_KEY"))
                .ok_or_else(|| Error::msg("Missing FMP_API_KEY"))?;

            let all_symbols = self.symbols.join(",");

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
                    let volume = value.volume;

                    match (price, volume) {
                        (Some(price), Some(volume)) => {
                            Some((value.symbol, PricePoint { price, volume }))
                        }
                        _ => {
                            print_missing_network_price_data("FMP", value.symbol, price, volume);
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
