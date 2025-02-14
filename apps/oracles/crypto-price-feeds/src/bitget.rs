use anyhow::Result;
use blocksense_sdk::spin::http::{send, Response};

use serde::Deserialize;

use crate::common::{Fetcher, PairPriceData};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BitgetPriceData {
    pub symbol: String,
    pub close: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BitgetPriceResponse {
    pub code: String,
    pub data: Vec<BitgetPriceData>,
}
pub struct BitgetFetcher;

impl Fetcher for BitgetFetcher {
    type ParsedResponse = PairPriceData;
    type ApiResponse = BitgetPriceResponse;
    const NAME: &str = "Bitget";

    fn get_request() -> Result<blocksense_sdk::spin::http::Request> {
        Self::prepare_get_request("https://api.bitget.com/api/spot/v1/market/tickers", None)
    }

    fn parse_response(value: BitgetPriceResponse) -> Result<Self::ParsedResponse> {
        let response: Self::ParsedResponse = value
            .data
            .into_iter()
            .map(|value| (value.symbol, value.close))
            .collect();

        Ok(response)
    }
}
