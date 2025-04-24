use anyhow::Result;
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;
use serde_this_or_that::as_f64;

use blocksense_sdk::{
    http::http_get_json,
    traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher},
};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct OKXTickerData {
    #[serde(rename = "instId")]
    pub inst_id: String,
    #[serde(deserialize_with = "as_f64")]
    pub last: f64,
    #[serde(deserialize_with = "as_f64")]
    pub vol24h: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct OKXTickerResponse {
    pub code: String,
    pub data: Vec<OKXTickerData>,
}

pub struct OKXPriceFetcher;

impl PricesFetcher<'_> for OKXPriceFetcher {
    const NAME: &'static str = "OKX";

    fn new(_symbols: &[String], _api_key: Option<&str>) -> Self {
        Self
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<OKXTickerResponse>(
                "https://www.okx.com/api/v5/market/tickers",
                Some(&[("instType", "SPOT")]),
                None,
            )
            .await?;

            Ok(response
                .data
                .into_iter()
                .map(|value| {
                    (
                        value.inst_id.replace("-", ""),
                        PricePoint {
                            price: value.last,
                            volume: value.vol24h,
                        },
                    )
                })
                .collect())
        }
        .boxed_local()
    }
}
