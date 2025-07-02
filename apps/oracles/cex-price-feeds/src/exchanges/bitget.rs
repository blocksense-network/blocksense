use anyhow::Result;
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;
use serde_this_or_that::as_f64;

use blocksense_data_providers_sdk::price_data::traits::prices_fetcher::{
    PairPriceData, PricePoint, PricesFetcher,
};
use blocksense_sdk::http::http_get_json;

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitgetPriceData {
    pub symbol: String,
    #[serde(deserialize_with = "as_f64")]
    pub close: f64,
    #[serde(deserialize_with = "as_f64")]
    pub base_vol: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitgetPriceResponse {
    pub code: String,
    pub data: Vec<BitgetPriceData>,
}
pub struct BitgetPriceFetcher;

impl PricesFetcher<'_> for BitgetPriceFetcher {
    const NAME: &'static str = "Bitget";

    fn new(_symbols: &[String], _api_key: Option<&str>) -> Self {
        Self
    }
    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<BitgetPriceResponse>(
                "https://api.bitget.com/api/spot/v1/market/tickers",
                None,
                None,
            )
            .await?;

            Ok(response
                .data
                .into_iter()
                .map(|value| {
                    (
                        value.symbol,
                        PricePoint {
                            price: value.close,
                            volume: value.base_vol,
                        },
                    )
                })
                .collect())
        }
        .boxed_local()
    }
}
