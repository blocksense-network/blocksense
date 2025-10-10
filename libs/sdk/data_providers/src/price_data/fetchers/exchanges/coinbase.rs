use std::collections::HashMap;

use anyhow::Result;
use futures::{
    future::LocalBoxFuture,
    stream::{FuturesUnordered, StreamExt},
    FutureExt,
};
use std::ops::Deref;

use serde::Deserialize;
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
pub struct CoinbasePriceResponse {
    #[serde(deserialize_with = "as_f64")]
    pub price: f64,
    #[serde(deserialize_with = "as_f64")]
    pub volume: f64,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct CoinbaseErrorResponse {
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(untagged)]
pub enum CoinbaseApiResponse {
    Success(CoinbasePriceResponse),
    Error(CoinbaseErrorResponse),
}

pub struct CoinbasePriceFetcher<'a> {
    pub symbols: &'a [String],
}

impl<'a> PricesFetcher<'a> for CoinbasePriceFetcher<'a> {
    const NAME: &'static str = "Coinbase";

    fn new(symbols: &'a [String], _api_keys: Option<HashMap<String, String>>) -> Self {
        Self { symbols }
    }

    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<'_, Result<PairPriceData>> {
        async move {
            let prices_futures = self
                .symbols
                .iter()
                .map(Deref::deref)
                .map(|url| fetch_price_for_symbol(url, timeout_secs));

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
                    warn!("Coinbase rate limits: [{}]", symbols.join(", "));
                }

                if !other_errors.is_empty() {
                    let symbol_errors: Vec<_> = other_errors
                        .iter()
                        .map(|e| format!("{}: {}", e.symbol, e.error))
                        .collect();
                    warn!("Coinbase errors: [{}]", symbol_errors.join(", "));
                }
            }

            if prices.is_empty() {
                anyhow::bail!("No prices fetched from Coinbase");
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
    let url = format!("https://api.exchange.coinbase.com/products/{symbol}/ticker");

    let response =
        match http_get_json::<CoinbaseApiResponse>(&url, None, None, Some(timeout_secs)).await {
            Ok(resp) => resp,
            Err(e) => {
                return Err(SymbolError {
                    symbol: symbol.to_string(),
                    error: e.to_string(),
                });
            }
        };

    match response {
        CoinbaseApiResponse::Success(price_data) => Ok((
            symbol.to_string(),
            PricePoint {
                price: price_data.price,
                volume: price_data.volume,
            },
        )),
        CoinbaseApiResponse::Error(error) => Err(SymbolError {
            symbol: symbol.to_string(),
            error: error.message,
        }),
    }
}
