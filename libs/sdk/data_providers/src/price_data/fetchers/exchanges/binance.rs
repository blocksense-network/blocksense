use std::collections::HashMap;

use anyhow::Result;
use futures::{future::LocalBoxFuture, FutureExt};

use itertools::Itertools;
use serde::Deserialize;
use serde_this_or_that::as_f64;

use blocksense_sdk::http::http_get_json;

use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinancePriceData {
    pub symbol: String,
    #[serde(deserialize_with = "as_f64")]
    pub last_price: f64,
    #[serde(deserialize_with = "as_f64")]
    pub volume: f64,
}

type BinancePriceResponse = Vec<BinancePriceData>;

pub struct BinancePriceFetcher<'a> {
    pub symbols: &'a [String],
}

impl<'a> PricesFetcher<'a> for BinancePriceFetcher<'a> {
    const NAME: &'static str = "Binance";

    fn new(symbols: &'a [String], _api_keys: Option<HashMap<String, String>>) -> Self {
        Self { symbols }
    }

    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<'_, Result<PairPriceData>> {
        async move {
            let req_symbols = format!(
                "[{}]",
                self.symbols.iter().map(|s| format!("\"{s}\"")).join(",")
            );

            let response = http_get_json::<BinancePriceResponse>(
                "https://api1.binance.com/api/v3/ticker/24hr",
                Some(&[("symbols", req_symbols.as_str())]),
                None,
                Some(timeout_secs),
            )
            .await?;

            Ok(response
                .into_iter()
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
