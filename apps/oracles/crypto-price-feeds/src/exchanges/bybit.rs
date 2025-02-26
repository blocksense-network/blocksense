use anyhow::Result;
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;

use crate::{common::PairPriceData, http::http_get_json, traits::prices_fetcher::PricesFetcher};

//TODO(adikov): Include all the needed fields form the response like volume.
#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BybitPriceData {
    pub symbol: String,
    pub last_price: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BybitResult {
    pub category: String,
    pub list: Vec<BybitPriceData>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BybitPriceResponse {
    pub ret_code: u32,
    pub ret_msg: String,
    pub result: BybitResult,
}
pub struct BybitPriceFetcher;

impl PricesFetcher<'_> for BybitPriceFetcher {
    const NAME: &'static str = "Bybit";

    fn new(_symbols: &[String]) -> Self {
        Self
    }
    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<BybitPriceResponse>(
                "https://api.bybit.com/v5/market/tickers",
                Some(&[("category", "spot"), ("symbols", "")]),
            )
            .await?;

            Ok(response
                .result
                .list
                .into_iter()
                .map(|value| (value.symbol, value.last_price))
                .collect())
        }
        .boxed_local()
    }
}
