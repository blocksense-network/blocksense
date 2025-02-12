use anyhow::{Ok, Result};
use blocksense_sdk::spin::http::{send, Response};

use serde::Deserialize;

use crate::common::{Fetcher, PairPriceData};

//TODO(adikov): Include all the needed fields form the response like volume.
#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BybitPriceData {
    pub symbol: String,
    pub last_price: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BybitResult {
    pub category: String,
    pub list: Vec<BybitPriceData>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BybitPriceResponse {
    pub ret_code: u32,
    pub ret_msg: String,
    pub result: BybitResult,
}

struct BybitFetcher;

impl Fetcher for BybitFetcher {
    type ParsedResponse = PairPriceData;
    type ApiResponse = BybitPriceResponse;

    fn parse_response(&self, value: BybitPriceResponse) -> Result<Self::ParsedResponse> {
        let response: PairPriceData = value
            .result
            .list
            .into_iter()
            .map(|value| (value.symbol, value.last_price))
            .collect();

        Ok(response)
    }
}

pub async fn get_bybit_prices() -> Result<PairPriceData> {
    let fetcher = BybitFetcher {};
    let req = fetcher.prepare_get_request(
        "https://api.bybit.com/v5/market/tickers",
        Some(&[("category", "spot"), ("symbols", "")]),
    );
    let resp: Response = send(req?).await?;
    let deserialized = fetcher.deserialize_response(resp)?;
    let pair_prices: PairPriceData = fetcher.parse_response(deserialized)?;

    Ok(pair_prices)
}
