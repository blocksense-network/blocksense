use std::collections::HashMap;

use anyhow::Result;
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;
use serde_this_or_that::as_f64;

use blocksense_sdk::http::http_get_json;

use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher};

//TODO(adikov): Include all the needed fields form the response like volume.
#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BybitPriceData {
    pub symbol: String,
    #[serde(deserialize_with = "as_f64")]
    pub last_price: f64,
    #[serde(deserialize_with = "as_f64")]
    pub volume24h: f64,
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

    fn new(_symbols: &[String], _api_keys: Option<HashMap<String, String>>) -> Self {
        Self
    }
    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<Result<PairPriceData>> {
        async move {
            let response = http_get_json::<BybitPriceResponse>(
                "https://api.bybit.com/v5/market/tickers",
                Some(&[("category", "spot"), ("symbols", "")]),
                None,
                Some(timeout_secs),
            )
            .await?;

            Ok(response
                .result
                .list
                .into_iter()
                .map(|value| {
                    // We need this step because Bybit return the volume denominated in the price currency
                    let volume = value.volume24h / value.last_price;
                    (
                        value.symbol,
                        PricePoint {
                            price: value.last_price,
                            volume,
                        },
                    )
                })
                .collect())
        }
        .boxed_local()
    }
}
