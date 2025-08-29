use std::{collections::HashMap, ops::Deref};

use anyhow::{Error, Result};
use futures::{future::LocalBoxFuture, stream::FuturesUnordered, FutureExt, StreamExt};
use serde::Deserialize;
use serde_this_or_that::as_f64;

use blocksense_sdk::http::http_get_json;
use tracing::warn;

use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher};

#[derive(Debug, Deserialize)]
pub struct AlphaVantageResponse {
    #[serde(rename = "Realtime Currency Exchange Rate")]
    pub realtime_currency_exchange_rate: RealtimeCurrencyExchangeRate,
}

#[derive(Debug, Deserialize)]
pub struct RealtimeCurrencyExchangeRate {
    #[serde(rename = "1. From_Currency Code")]
    pub from_currency_code: String,

    #[serde(rename = "3. To_Currency Code")]
    pub to_currency_code: String,

    #[serde(rename = "5. Exchange Rate")]
    #[serde(deserialize_with = "as_f64")]
    pub exchange_rate: f64,
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

    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<Result<PairPriceData>> {
        async move {
            let api_key = self
                .api_keys
                .as_ref()
                .and_then(|map| map.get("ALPHAVANTAGE_API_KEY"))
                .ok_or_else(|| Error::msg("Missing ALPHAVANTAGE_API_KEY"))?;

            let prices_futures = self.symbols.iter().map(Deref::deref).map(|symbol| {
                let parts: Vec<&str> = symbol.split(':').collect();
                let (from_currency, to_currency) = (parts[0], parts[1]);

                fetch_price_for_pair(from_currency, to_currency, api_key, timeout_secs)
            });

            let mut futures = FuturesUnordered::from_iter(prices_futures);
            let mut prices = PairPriceData::new();

            while let Some(result) = futures.next().await {
                match result {
                    Ok((symbol, price_point)) => {
                        prices.insert(symbol, price_point);
                    }
                    Err(err) => {
                        warn!("Error processing future in AlphaVantagePriceFetcher {err:?}")
                    }
                }
            }

            if prices.is_empty() {
                anyhow::bail!("No prices fetched from AlphaVantage");
            }

            Ok(prices)
        }
        .boxed_local()
    }
}

pub async fn fetch_price_for_pair(
    from_currency: &str,
    to_currency: &str,
    apikey: &str,
    timeout_secs: u64,
) -> Result<(String, PricePoint)> {
    let response = http_get_json::<AlphaVantageResponse>(
        "https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE",
        Some(&[
            ("from_currency", from_currency),
            ("to_currency", to_currency),
            ("apikey", apikey),
        ]),
        None,
        Some(timeout_secs),
    )
    .await?;

    Ok((
        format!("{from_currency}{to_currency}"),
        PricePoint {
            price: response.realtime_currency_exchange_rate.exchange_rate,
            volume: 1.0,
        },
    ))
}
