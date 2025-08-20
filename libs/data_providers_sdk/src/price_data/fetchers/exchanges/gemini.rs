use std::{collections::HashMap, ops::Deref};

use anyhow::Result;
use futures::{
    future::LocalBoxFuture,
    stream::{FuturesUnordered, StreamExt},
    FutureExt,
};

use serde::Deserialize;
use serde_json::Value;
use serde_this_or_that::as_f64;

use blocksense_sdk::http::http_get_json;

use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct GeminiPriceResponse {
    #[serde(deserialize_with = "as_f64")]
    pub last: f64,
    pub volume: HashMap<String, Value>,
}

pub struct GeminiPriceFetcher<'a> {
    pub symbols: &'a [String],
}

impl<'a> PricesFetcher<'a> for GeminiPriceFetcher<'a> {
    const NAME: &'static str = "Gemini";

    fn new(symbols: &'a [String], _api_keys: Option<HashMap<String, String>>) -> Self {
        Self { symbols }
    }

    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<Result<PairPriceData>> {
        async move {
            let prices_futures = self
                .symbols
                .iter()
                .map(Deref::deref)
                .map(|symbol| fetch_price_for_symbol(symbol, timeout_secs));

            let mut futures = FuturesUnordered::from_iter(prices_futures);
            let mut prices = PairPriceData::new();

            while let Some(result) = futures.next().await {
                match result {
                    Ok((symbol, price_pint)) => {
                        prices.insert(symbol, price_pint);
                    }
                    Err(err) => {
                        anyhow::bail!("Error processing future in GeminiPriceFetcher {err:?}")
                    }
                }
            }

            Ok(prices)
        }
        .boxed_local()
    }
}

pub async fn fetch_price_for_symbol(
    symbol: &str,
    timeout_secs: u64,
) -> Result<(String, PricePoint)> {
    let url = format!("https://api.gemini.com/v1/pubticker/{symbol}");
    let response = http_get_json::<GeminiPriceResponse>(&url, None, None, timeout_secs).await?;

    let volume_data = response
        .volume
        .iter()
        .find(|(key, _)| symbol.starts_with(*key));

    let volume = match volume_data {
        Some((_, value)) => value.as_str().unwrap_or("").parse::<f64>().unwrap_or(0.0),
        None => 0.0,
    };

    Ok((
        symbol.to_string(),
        PricePoint {
            price: response.last,
            volume,
        },
    ))
}
