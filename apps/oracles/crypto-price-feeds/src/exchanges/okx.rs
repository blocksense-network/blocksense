use anyhow::{Context, Result};
use futures::{
    future::LocalBoxFuture,
    stream::{FuturesUnordered, StreamExt},
    FutureExt,
};
use std::ops::Deref;

use serde::Deserialize;

use crate::{
    common::{http_get_json, PairPriceData},
    traits::prices_fetcher::PricesFetcher,
};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct OKXInstrument {
    #[serde(rename = "instId")]
    pub inst_id: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct OKXInstrumentResponse {
    pub code: String,
    pub data: Vec<OKXInstrument>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct OKXTickerData {
    #[serde(rename = "instId")]
    pub inst_id: String,
    #[serde(rename = "idxPx")]
    pub idx_px: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct OKXTickerResponse {
    pub code: String,
    pub data: Vec<OKXTickerData>,
}

pub struct OKXPriceFetcher<'a> {
    pub symbols: &'a [String],
}

impl<'a> OKXPriceFetcher<'a> {
    pub fn new(symbols: &'a [String]) -> Self {
        Self { symbols }
    }
}

impl PricesFetcher for OKXPriceFetcher<'_> {
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
                    prices.insert(symbol.replace("-", ""), price);
                }
            }

            Ok(prices)
        }
        .boxed_local()
    }
}

async fn fetch_price_for_symbol(symbol: &str) -> Result<(String, String)> {
    let url = format!("https://www.okx.com/api/v5/market/index-tickers?instId={symbol}");
    let response = http_get_json::<OKXTickerResponse>(&url, None).await?;

    response
        .data
        .first()
        .context("No data")
        .map(|data| (data.inst_id.clone(), data.idx_px.clone()))
}

pub async fn fetch_okx_symbols() -> Result<Vec<String>> {
    let response = http_get_json::<OKXInstrumentResponse>(
        "https://www.okx.com/api/v5/public/instruments?instType=SPOT",
        None,
    )
    .await?;

    Ok(response
        .data
        .into_iter()
        .map(|symbol| symbol.inst_id)
        .collect())
}
