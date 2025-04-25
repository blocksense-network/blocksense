use std::ops::Deref;

use anyhow::{Error, Result};
use futures::{
    future::LocalBoxFuture,
    stream::{FuturesUnordered, StreamExt},
    FutureExt,
};

use serde::Deserialize;
use serde_this_or_that::as_f64;

use blocksense_sdk::{
    http::http_get_json,
    traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher},
};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct AlphaVantagePriceData {
    #[serde(rename = "05. price", deserialize_with = "as_f64")]
    pub price: f64,

    #[serde(rename = "06. volume", deserialize_with = "as_f64")]
    pub volume: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct AlphaVantageResponse {
    #[serde(rename = "Global Quote")]
    pub global_quote: AlphaVantagePriceData,
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

            let prices_futures = self
                .symbols
                .iter()
                .map(Deref::deref)
                .map(|symbol| fetch_price_for_symbol(symbol, api_key));

            let mut futures = FuturesUnordered::from_iter(prices_futures);
            let mut prices = PairPriceData::new();

            while let Some(result) = futures.next().await {
                match result {
                    Ok((symbol, price_point)) => {
                        prices.insert(symbol, price_point);
                    }
                    Err(err) => {
                        eprintln!("Fetching price from {:?} failed: {:?}", Self::NAME, err);
                    }
                }
            }

            if prices.is_empty() {
                return Err(Error::msg("No prices fetched. Rate limit exceeded?"));
            }
            Ok(prices)
        }
        .boxed_local()
    }
}

pub async fn fetch_price_for_symbol(symbol: &str, api_key: &str) -> Result<(String, PricePoint)> {
    let url = "https://www.alphavantage.co/query".to_string();
    let response = http_get_json::<AlphaVantageResponse>(
        &url,
        Some(&[
            ("function", "GLOBAL_QUOTE"),
            ("symbol", symbol),
            ("apikey", api_key),
        ]),
        None,
    )
    .await;

    match response {
        Ok(response) => Ok((
            symbol.to_string(),
            PricePoint {
                price: response.global_quote.price,
                volume: response.global_quote.volume,
            },
        )),
        Err(err) => Err(Error::msg(format!(
            "Error fetching price for symbol {symbol}: {err}"
        ))),
    }
}
