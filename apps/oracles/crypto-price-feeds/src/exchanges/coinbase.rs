use anyhow::Result;
use futures::{
    future::LocalBoxFuture,
    stream::{FuturesUnordered, StreamExt},
    FutureExt,
};
use std::ops::Deref;

use serde::Deserialize;
use serde_this_or_that::as_f64;

use crate::{
    common::{PairPriceData, PricePoint},
    http::http_get_json,
    traits::prices_fetcher::PricesFetcher,
};

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

    fn new(symbols: &'a [String]) -> Self {
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
    let url = format!("https://api.exchange.coinbase.com/products/{symbol}/ticker");
    let response = http_get_json::<CoinbasePriceResponse>(&url, None).await?;

    Ok((
        symbol.to_string().replace("-", ""),
        PricePoint {
            price: response.price,
            volume: response.volume,
        },
    ))
}
