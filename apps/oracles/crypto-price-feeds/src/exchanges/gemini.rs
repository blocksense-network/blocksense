use anyhow::Result;
use futures::{
    future::LocalBoxFuture,
    stream::{FuturesUnordered, StreamExt},
    FutureExt,
};
use std::ops::Deref;

use serde::Deserialize;
use serde_this_or_that::as_f64;

use crate::{common::PairPriceData, http::http_get_json, traits::prices_fetcher::PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct GeminiPriceResponse {
    #[serde(deserialize_with = "as_f64")]
    pub last: f64,
}

type GeminiSymbolsResponse = Vec<String>;

pub struct GeminiPriceFetcher<'a> {
    pub symbols: &'a [String],
}

impl<'a> PricesFetcher<'a> for GeminiPriceFetcher<'a> {
    const NAME: &'static str = "Gemini";

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
                if let Ok((symbol, price)) = result {
                    prices.insert(symbol, price);
                }
            }

            Ok(prices)
        }
        .boxed_local()
    }
}

pub async fn fetch_price_for_symbol(symbol: &str) -> Result<(String, f64)> {
    let url = format!("https://api.gemini.com/v1/pubticker/{symbol}");
    let response = http_get_json::<GeminiPriceResponse>(&url, None).await?;

    Ok((symbol.to_string(), response.last))
}

pub async fn get_gemini_symbols() -> Result<Vec<String>> {
    let response =
        http_get_json::<GeminiSymbolsResponse>("https://api.gemini.com/v1/symbols", None).await?;

    Ok(response
        .into_iter()
        .filter(|symbol| !symbol.ends_with("perp"))
        .map(|symbol| symbol.to_ascii_uppercase())
        .collect())
}
