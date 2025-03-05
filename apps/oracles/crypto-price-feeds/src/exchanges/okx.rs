use anyhow::Result;
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;
use serde_this_or_that::as_f64;

use crate::{
    common::{PairPriceData, PricePoint},
    http::http_get_json,
    traits::prices_fetcher::PricesFetcher,
};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct OKXTickerData {
    #[serde(rename = "instId")]
    pub inst_id: String,
    #[serde(deserialize_with = "as_f64")]
    pub last: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct OKXTickerResponse {
    pub code: String,
    pub data: Vec<OKXTickerData>,
}

pub struct OKXPriceFetcher;

impl PricesFetcher<'_> for OKXPriceFetcher {
    const NAME: &'static str = "OKX";

    fn new(_symbols: &[String]) -> Self {
        Self
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<OKXTickerResponse>(
                "https://www.okx.com/api/v5/market/tickers",
                Some(&[("instType", "SPOT")]),
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
                            volume: 1.0,
                        },
                    )
                })
                .collect())
        }
        .boxed_local()
    }
}
