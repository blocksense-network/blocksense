use anyhow::Result;
use futures::{
    future::LocalBoxFuture,
    stream::{FuturesUnordered, StreamExt},
    FutureExt,
};
use std::{collections::HashMap, ops::Deref};

use serde::Deserialize;
use serde_json::Value;
use serde_this_or_that::as_f64;

use blocksense_sdk::{
    http::http_get_json,
    traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher},
};

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

    fn new(symbols: &'a [String], _api_key: Option<&'a str>) -> Self {
        Self { symbols }
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let prices_futures = self
                .symbols
                .iter()
                .map(Deref::deref)
                .map(fetch_price_for_symbol);

            let mut futures = FuturesUnordered::from_iter(prices_futures);
            let mut prices = PairPriceData::new();

            while let Some(result) = futures.next().await {
                if let Ok((symbol, price_pint)) = result {
                    prices.insert(symbol, price_pint);
                }
            }

            Ok(prices)
        }
        .boxed_local()
    }
}

pub async fn fetch_price_for_symbol(symbol: &str) -> Result<(String, PricePoint)> {
    let url = format!("https://api.gemini.com/v1/pubticker/{symbol}");
    let response = http_get_json::<GeminiPriceResponse>(&url, None, None).await?;

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
