use std::collections::HashMap;

use anyhow::{Context, Result};
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;
use serde_json::Value;

use crate::{common::PairPriceData, http::http_get_json, traits::prices_fetcher::PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KrakenPriceData {
    pub a: Vec<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KrakenPriceResponse {
    pub error: Vec<Value>,
    pub result: HashMap<String, KrakenPriceData>,
}

pub struct KrakenPriceFetcher;

impl PricesFetcher for KrakenPriceFetcher {
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
                    let price = price_data
                        .a
                        .first()
                        .context(format!(
                            "Kraken has no price in response for symbol: {}",
                            symbol
                        ))?
                        .clone();
                    Ok((symbol, price))
                })
                .collect::<Result<PairPriceData>>()
        }
        .boxed_local()
    }
}
