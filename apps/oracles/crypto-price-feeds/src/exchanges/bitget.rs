use anyhow::Result;

use futures::FutureExt;
use serde::Deserialize;
use serde_this_or_that::as_f64;

use crate::{common::PairPriceData, http::http_get_json, traits::prices_fetcher::PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BitgetPriceData {
    pub symbol: String,

    #[serde(deserialize_with = "as_f64")]
    pub close: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BitgetPriceResponse {
    pub code: String,
    pub data: Vec<BitgetPriceData>,
}
pub struct BitgetPriceFetcher;

impl PricesFetcher<'_> for BitgetPriceFetcher {
    const NAME: &'static str = "Bitget";

    fn new(_symbols: &[String]) -> Self {
        Self
    }

    fn fetch(&self) -> futures::future::LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<BitgetPriceResponse>(
                "https://api.bitget.com/api/spot/v1/market/tickers",
                None,
            )
            .await?;

            Ok(response
                .data
                .into_iter()
                .map(|value| (value.symbol, value.close))
                .collect())
        }
        .boxed_local()
    }
}
