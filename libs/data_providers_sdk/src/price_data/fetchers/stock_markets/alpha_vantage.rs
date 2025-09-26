use std::collections::HashMap;

use anyhow::{Error, Result};
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;
use serde_this_or_that::as_f64;

use blocksense_sdk::http::http_get_json;

use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct PriceData {
    pub symbol: String,
    #[serde(deserialize_with = "as_f64")]
    pub close: f64,
    #[serde(deserialize_with = "as_f64")]
    pub volume: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct AlphaVantageResponse {
    pub data: Vec<PriceData>,
}

pub struct AlphaVantagePriceFetcher<'a> {
    pub symbols: &'a [String],
    api_keys: Option<HashMap<String, String>>,
}

impl<'a> PricesFetcher<'a> for AlphaVantagePriceFetcher<'a> {
    const NAME: &'static str = "AlphaVantage";

    fn new(symbols: &'a [String], api_key: Option<HashMap<String, String>>) -> Self {
        Self {
            symbols,
            api_keys: api_key,
        }
    }

    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<'_, Result<PairPriceData>> {
        async move {
            let api_key = self
                .api_keys
                .as_ref()
                .and_then(|map| map.get("ALPHAVANTAGE_API_KEY"))
                .ok_or_else(|| Error::msg("Missing ALPHAVANTAGE_API_KEY"))?;

            let all_symbols = self.symbols.join(",");

            let response = http_get_json::<AlphaVantageResponse>(
                "https://www.alphavantage.co/query?function=REALTIME_BULK_QUOTES",
                Some(&[("symbol", &all_symbols), ("apikey", api_key)]),
                None,
                Some(timeout_secs),
            )
            .await?;
            let results = response
                .data
                .into_iter()
                .map(|data| {
                    let price = data.close;
                    let volume = data.volume;

                    (data.symbol, PricePoint { price, volume })
                })
                .collect::<PairPriceData>();
            Ok(results)
        }
        .boxed_local()
    }
}
