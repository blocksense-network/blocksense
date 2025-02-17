use anyhow::Result;

use serde::Deserialize;

use crate::common::{prepare_get_request, Fetcher, PairPriceData};

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

    fn get_request(&self) -> Result<blocksense_sdk::spin::http::Request> {
        prepare_get_request("https://api.bitget.com/api/spot/v1/market/tickers", None)
    }

    fn parse_response(value: Self::ApiResponse) -> Result<Self::ParsedResponse> {
        let response = value
            .data
            .into_iter()
            .map(|value| (value.symbol, value.close))
            .collect();

        Ok(response)
    }
}
