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
pub struct MEXCPriceData {
    pub symbol: String,
    #[serde(deserialize_with = "as_f64")]
    pub price: f64,
}

type MEXCPriceResponse = Vec<MEXCPriceData>;

pub struct MEXCPriceFetcher;

impl PricesFetcher<'_> for MEXCPriceFetcher {
    const NAME: &'static str = "MEXC";

    fn new(_symbols: &[String]) -> Self {
        Self
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<MEXCPriceResponse>(
                "https://api.mexc.com/api/v3/ticker/price",
                None,
            )
            .await?;

            Ok(response
                .into_iter()
                .map(|value| {
                    (
                        value.symbol,
                        PricePoint {
                            price: value.price,
                            volume: 1.0,
                        },
                    )
                })
                .collect())
        }
        .boxed_local()
    }
}
