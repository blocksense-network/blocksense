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

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CoinbasePriceResponse {
    #[serde(deserialize_with = "as_f64")]
    pub price: f64,
    #[serde(deserialize_with = "as_f64")]
    pub volume: f64,
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

            while let Some(result) = futures.next().await {
                match result {
                    Ok((symbol, price_pint)) => {
                        prices.insert(symbol, price_pint);
                    }
                    Err(err) => {
                        warn!("Error processing future in CoinbasePriceFetcher {err:?}")
                    }
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
) -> Result<(String, PricePoint)> {
    let url = format!("https://api.exchange.coinbase.com/products/{symbol}/ticker");
    let response =
        http_get_json::<CoinbasePriceResponse>(&url, None, None, Some(timeout_secs)).await?;

    Ok((
        symbol.to_string().replace("-", ""),
        PricePoint {
            price: response.price,
            volume: response.volume,
        },
    ))
}
