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
#[serde(rename_all = "camelCase")]
pub struct BinancePriceData {
    pub symbol: String,
    #[serde(deserialize_with = "as_f64")]
    pub last_price: f64,
}

type BinancePriceResponse = Vec<BinancePriceData>;

pub struct BinancePriceFetcher;

impl PricesFetcher<'_> for BinancePriceFetcher {
    const NAME: &'static str = "Binance";

    fn new(_symbols: &[String]) -> Self {
        Self
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<BinancePriceResponse>(
                "https://api1.binance.com/api/v3/ticker/24hr",
                None,
            )
            .await?;

            Ok(response
                .into_iter()
                .map(|value| {
                    (
                        value.symbol,
                        PricePoint {
                            price: value.last_price,
                            volume: 1.0,
                        },
                    )
                })
                .collect())
        }
        .boxed_local()
    }
}
