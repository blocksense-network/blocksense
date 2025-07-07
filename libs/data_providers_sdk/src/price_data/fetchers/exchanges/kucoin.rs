use std::str::FromStr;

use std::collections::HashMap;

use anyhow::Result;
use futures::{future::LocalBoxFuture, FutureExt};

use serde::{Deserialize, Deserializer};

use blocksense_sdk::http::http_get_json;

use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher};

fn as_f64_option<'de, D>(deserializer: D) -> Result<Option<f64>, D::Error>
where
    D: Deserializer<'de>,
{
    let s: Option<String> = Option::deserialize(deserializer)?;
    match s {
        Some(s) => f64::from_str(&s)
            .map(Some)
            .map_err(serde::de::Error::custom),
        None => Ok(None),
    }
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KuCoinPrice {
    pub symbol: String,
    #[serde(deserialize_with = "as_f64_option")]
    pub last: Option<f64>,
    #[serde(deserialize_with = "as_f64_option")]
    pub vol: Option<f64>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KuCoinResult {
    pub ticker: Vec<KuCoinPrice>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KuCoinPriceResponse {
    pub code: String,
    pub data: KuCoinResult,
}

pub struct KuCoinPriceFetcher;

impl PricesFetcher<'_> for KuCoinPriceFetcher {
    const NAME: &'static str = "KuCoin";

    fn new(_symbols: &[String], _api_keys: Option<HashMap<String, String>>) -> Self {
        Self
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<KuCoinPriceResponse>(
                "https://api.kucoin.com/api/v1/market/allTickers",
                None,
                None,
            )
            .await?;

            Ok(response
                .data
                .ticker
                .into_iter()
                .filter_map(|value| match (value.last, value.vol) {
                    (Some(last_price), Some(volume)) => Some((
                        value.symbol.replace("-", ""),
                        PricePoint {
                            price: last_price,
                            volume,
                        },
                    )),
                    _ => None,
                })
                .collect())
        }
        .boxed_local()
    }
}
