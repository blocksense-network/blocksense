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

use tracing::warn;

use blocksense_sdk::http::http_get_json;

use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher};

#[derive(Debug, Clone)]
pub struct SymbolError {
    pub symbol: String,
    pub error: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct GeminiPriceResponse {
    #[serde(deserialize_with = "as_f64")]
    pub last: f64,
    pub volume: HashMap<String, Value>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct GeminiErrorResponse {
    pub result: String,
    pub reason: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(untagged)]
pub enum GeminiApiResponse {
    Success(GeminiPriceResponse),
    Error(GeminiErrorResponse),
}

pub struct GeminiPriceFetcher<'a> {
    pub symbols: &'a [String],
}

impl<'a> PricesFetcher<'a> for GeminiPriceFetcher<'a> {
    const NAME: &'static str = "Gemini";

    fn new(symbols: &'a [String], _api_keys: Option<HashMap<String, String>>) -> Self {
        Self { symbols }
    }

    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<'_, Result<PairPriceData>> {
        async move {
            let prices_futures = self
                .symbols
                .iter()
                .map(Deref::deref)
                .map(|symbol| fetch_price_for_symbol(symbol, timeout_secs));

            let mut futures = FuturesUnordered::from_iter(prices_futures);
            let mut prices = PairPriceData::new();

            let mut errors = Vec::new();
            while let Some(result) = futures.next().await {
                match result {
                    Ok((symbol, price_point)) => {
                        prices.insert(symbol, price_point);
                    }
                    Err(symbol_error) => {
                        errors.push(symbol_error);
                    }
                }
            }

            // Log errors if any occurred
            if !errors.is_empty() {
                let (rate_limited, other_errors): (Vec<_>, Vec<_>) = errors
                    .into_iter()
                    .partition(|e| e.error.to_lowercase().contains("rate limit"));

                if !rate_limited.is_empty() {
                    let symbols: Vec<_> = rate_limited.iter().map(|e| e.symbol.as_str()).collect();
                    warn!("Gemini rate limits: [{}]", symbols.join(", "));
                }

                if !other_errors.is_empty() {
                    let symbol_errors: Vec<_> = other_errors
                        .iter()
                        .map(|e| format!("{}: {}", e.symbol, e.error))
                        .collect();
                    warn!("Gemini errors: [{}]", symbol_errors.join(", "));
                }
            }

            if prices.is_empty() {
                anyhow::bail!("No prices fetched from Gemini");
            }

            Ok(prices)
        }
        .boxed_local()
    }
}

pub async fn fetch_price_for_symbol(
    symbol: &str,
    timeout_secs: u64,
) -> Result<(String, PricePoint), SymbolError> {
    let url = format!("https://api.gemini.com/v1/pubticker/{symbol}");

    let response =
        match http_get_json::<GeminiApiResponse>(&url, None, None, Some(timeout_secs)).await {
            Ok(resp) => resp,
            Err(e) => {
                return Err(SymbolError {
                    symbol: symbol.to_string(),
                    error: e.to_string(),
                });
            }
        };

    match response {
        GeminiApiResponse::Success(price_data) => {
            let volume_data = price_data
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
                    price: price_data.last,
                    volume,
                },
            ))
        }
        GeminiApiResponse::Error(error) => Err(SymbolError {
            symbol: symbol.to_string(),
            error: format!("{}: {}", error.reason, error.message),
        }),
    }
}
