use std::collections::HashMap;

use anyhow::{Error, Result};
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;

use blocksense_sdk::http::http_get_json;

use crate::price_data::fetchers::stock_markets::utils::print_missing_provider_price_data;
use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct PriceData {
    pub symbol: String,
    pub close: Option<String>,
    pub volume: Option<String>,
    pub previous_close: Option<String>,
}

type TwelveDataResponse = HashMap<String, PriceData>;

pub struct TwelveDataPriceFetcher<'a> {
    pub symbols: &'a [String],
    api_keys: Option<HashMap<String, String>>,
}

impl<'a> PricesFetcher<'a> for TwelveDataPriceFetcher<'a> {
    const NAME: &'static str = "twelvedata";

    fn new(symbols: &'a [String], api_keys: Option<HashMap<String, String>>) -> Self {
        Self { symbols, api_keys }
    }

    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<Result<PairPriceData>> {
        async move {
            let api_key = self
                .api_keys
                .as_ref()
                .and_then(|map| map.get("TWELVEDATA_API_KEY"))
                .ok_or_else(|| Error::msg("Missing TWELVEDATA_API_KEY"))?;

            let all_symbols = self.symbols.join(",");

            let response = http_get_json::<TwelveDataResponse>(
                "https://api.twelvedata.com/quote",
                Some(&[("symbol", &all_symbols)]),
                Some(&[("Authorization", format!("apikey {api_key}").as_str())]),
                Some(timeout_secs),
            )
            .await?;

            let results = response
                .values()
                .filter_map(|value| {
                    let price = value.close.clone().or(value.previous_close.clone());
                    let volume = value.volume.clone();

                    match (price.clone(), volume.clone()) {
                        (Some(price), Some(volume)) => {
                            let price = price.parse::<f64>().unwrap_or(0.0);
                            let volume = volume.parse::<f64>().unwrap_or(0.0);
                            Some((value.symbol.clone(), PricePoint { price, volume }))
                        }
                        _ => {
                            print_missing_provider_price_data(
                                "TwelveData",
                                value.symbol.clone(),
                                price,
                                volume,
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
