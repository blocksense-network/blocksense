use std::collections::HashMap;

use anyhow::Result;
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;
use serde_this_or_that::as_f64;

use blocksense_sdk::http::http_get_json;

use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct GateIoPriceData {
    pub currency_pair: String,
    #[serde(deserialize_with = "as_f64")]
    pub last: f64,
    #[serde(deserialize_with = "as_f64")]
    pub base_volume: f64,
}

type GateIoPriceResponse = Vec<GateIoPriceData>;

pub struct GateIoPriceFetcher;

impl PricesFetcher<'_> for GateIoPriceFetcher {
    const NAME: &'static str = "Gate.io";

    fn new(_symbols: &[String], _api_keys: Option<HashMap<String, String>>) -> Self {
        Self
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<GateIoPriceResponse>(
                "https://api.gateio.ws/api/v4/spot/tickers",
                None,
                None,
            )
            .await?;

            Ok(response
                .into_iter()
                .map(|value| {
                    (
                        value.currency_pair.replace("_", ""),
                        PricePoint {
                            price: value.last,
                            volume: value.base_volume,
                        },
                    )
                })
                .collect())
        }
        .boxed_local()
    }
}
