use anyhow::Result;
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;
use serde_this_or_that::as_f64;

use blocksense_sdk::{
    http::http_get_json,
    traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher},
};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CryptoComPriceData {
    pub i: String,
    #[serde(deserialize_with = "as_f64")]
    pub a: f64,
    #[serde(deserialize_with = "as_f64")]
    pub v: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CryptoComResult {
    pub data: Vec<CryptoComPriceData>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CryptoComPriceResponse {
    pub code: i8,
    pub result: CryptoComResult,
}

pub struct CryptoComPriceFetcher;

impl PricesFetcher<'_> for CryptoComPriceFetcher {
    const NAME: &'static str = "Crypto.com";

    fn new(_symbols: &[String], _api_key: Option<&str>) -> Self {
        Self
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<CryptoComPriceResponse>(
                "https://api.crypto.com/exchange/v1/public/get-tickers",
                None,
            )
            .await?;

            Ok(response
                .result
                .data
                .into_iter()
                .map(|value| {
                    (
                        value.i.replace("_", ""),
                        PricePoint {
                            price: value.a,
                            volume: value.v,
                        },
                    )
                })
                .collect())
        }
        .boxed_local()
    }
}
