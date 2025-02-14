use anyhow::Result;
use blocksense_sdk::spin::http::{send, Response};

use serde::Deserialize;

use crate::common::{Fetcher, PairPriceData};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BinancePriceData {
    pub symbol: String,
    pub price: String,
}

type BinancePriceResponse = Vec<BinancePriceData>;

pub struct BinancePriceFetcher {
    // base_url: str,
    // params: Option<[(str, str)]>
}

impl Fetcher for BinancePriceFetcher {
    type ParsedResponse = PairPriceData;
    type ApiResponse = BinancePriceResponse;
    const NAME: &str = "Binance";

    fn get_request() -> Result<blocksense_sdk::spin::http::Request> {
        Self::prepare_get_request("https://api.binance.com/api/v3/ticker/price", None)
    }

    fn parse_response(value: BinancePriceResponse) -> Result<Self::ParsedResponse> {
        let response: Self::ParsedResponse = value
            .into_iter()
            .map(|value| (value.symbol, value.price))
            .collect();

        Ok(response)
    }
}
