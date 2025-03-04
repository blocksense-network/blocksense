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
pub struct BinanceUsPriceData {
    pub symbol: String,
    #[serde(deserialize_with = "as_f64")]
    pub last_price: f64,
    #[serde(deserialize_with = "as_f64")]
    pub volume: f64,
}

type BinanceUsPriceResponse = Vec<BinanceUsPriceData>;

pub struct BinanceUsPriceFetcher;

impl PricesFetcher<'_> for BinanceUsPriceFetcher {
    const NAME: &'static str = "Binance US";

    fn new(_symbols: &[String]) -> Self {
        Self
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<BinanceUsPriceResponse>(
                "https://api.binance.us/api/v3/ticker/24hr",
                None,
            )
            .await?;

            Ok(response
                .into_iter()
                .filter(|value| !value.symbol.ends_with("USD"))
                .map(|value| {
                    (
                        value.symbol,
                        PricePoint {
                            price: value.last_price,
                            volume: value.volume,
                        },
                    )
                })
                .collect())
        }
        .boxed_local()
    }
}
