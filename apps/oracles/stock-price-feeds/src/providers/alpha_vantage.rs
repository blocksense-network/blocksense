use anyhow::{Error, Result};
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;
use serde_this_or_that::as_f64;

use blocksense_data_providers_sdk::price_data::traits::prices_fetcher::{
    PairPriceData, PricePoint, PricesFetcher,
};
use blocksense_sdk::http::http_get_json;

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
    api_key: Option<&'a str>,
}

impl<'a> PricesFetcher<'a> for AlphaVantagePriceFetcher<'a> {
    const NAME: &'static str = "AlphaVantage";

    fn new(symbols: &'a [String], api_key: Option<&'a str>) -> Self {
        Self { symbols, api_key }
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let api_key = match self.api_key {
                Some(key) => key,
                None => {
                    return Err(Error::msg("API key is required for AlphaVantage"));
                }
            };

            let all_symbols = self.symbols.join(",");

            let response = http_get_json::<AlphaVantageResponse>(
                "https://www.alphavantage.co/query?function=REALTIME_BULK_QUOTES",
                Some(&[("symbol", &all_symbols), ("apikey", api_key)]),
                None,
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
