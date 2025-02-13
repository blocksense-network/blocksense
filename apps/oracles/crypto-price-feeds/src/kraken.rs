use anyhow::{Context, Ok, Result};
use blocksense_sdk::spin::http::{send, Response};
use std::collections::HashMap;

use serde::Deserialize;
use serde_json::Value;

use crate::common::{Fetcher, PairPriceData};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KrakenPriceData {
    pub a: Vec<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KrakenPriceResponse {
    pub error: Vec<Value>,
    pub result: HashMap<String, KrakenPriceData>,
}

struct KrakenPriceFetcher;

impl Fetcher for KrakenPriceFetcher {
    type ParsedResponse = PairPriceData;
    type ApiResponse = KrakenPriceResponse;

    fn parse_response(&self, value: KrakenPriceResponse) -> Result<Self::ParsedResponse> {
        let mut response: PairPriceData = HashMap::new();
        for (symbol, price) in value.result {
            response.insert(
                symbol.clone(),
                price
                    .a
                    .first()
                    .context(format!(
                        "Kraken has no price in response for symbol: {}",
                        symbol
                    ))?
                    .clone(),
            );
        }

        Ok(response)
    }
}

pub async fn get_kraken_prices() -> Result<PairPriceData> {
    let fetcher = KrakenPriceFetcher {};
    let req = fetcher.prepare_get_request("https://api.kraken.com/0/public/Ticker", None)?;
    let resp: Response = send(req).await?;
    let deserialized = fetcher.deserialize_response(resp)?;
    let pair_prices: PairPriceData = fetcher.parse_response(deserialized)?;

    Ok(pair_prices)
}
