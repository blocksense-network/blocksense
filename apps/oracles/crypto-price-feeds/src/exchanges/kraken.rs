use std::collections::HashMap;
use std::str::FromStr;

use anyhow::{Context, Result};
use futures::{future::LocalBoxFuture, FutureExt};

use serde::{Deserialize, Deserializer};
use serde_json::Value;

use blocksense_sdk::http::http_get_json;

use crate::{
    common::{PairPriceData, PricePoint},
    traits::prices_fetcher::PricesFetcher,
};

fn as_f64_vec<'de, D>(deserializer: D) -> Result<Vec<f64>, D::Error>
where
    D: Deserializer<'de>,
{
    let s: Vec<String> = Deserialize::deserialize(deserializer)?;
    s.into_iter()
        .map(|s| f64::from_str(&s).map_err(serde::de::Error::custom))
        .collect()
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KrakenPriceData {
    #[serde(deserialize_with = "as_f64_vec")]
    pub a: Vec<f64>,
    #[serde(deserialize_with = "as_f64_vec")]
    pub v: Vec<f64>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KrakenPriceResponse {
    pub error: Vec<Value>,
    pub result: HashMap<String, KrakenPriceData>,
}

pub struct KrakenPriceFetcher;

impl PricesFetcher<'_> for KrakenPriceFetcher {
    const NAME: &'static str = "Kraken";

    fn new(_symbols: &[String]) -> Self {
        Self
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<KrakenPriceResponse>(
                "https://api.kraken.com/0/public/Ticker",
                None,
            )
            .await?;

            response
                .result
                .into_iter()
                .map(|(symbol, price_data)| {
                    let price = *price_data.a.first().with_context(|| {
                        format!("Kraken has no price in response for symbol: {symbol}")
                    })?;
                    let volume = *price_data.v.get(1).with_context(|| {
                        format!("Kraken has no second volume in response for symbol: {symbol}")
                    })?;
                    Ok((symbol, PricePoint { price, volume }))
                })
                .collect::<Result<PairPriceData>>()
        }
        .boxed_local()
    }
}
