use anyhow::Result;
use blocksense_sdk::spin::http::{send, Response};

use serde::Deserialize;

use crate::common::{Fetcher, PairPriceData};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct MEXCPriceData {
    pub symbol: String,
    pub price: String,
}

type MEXCPriceResponse = Vec<MEXCPriceData>;

struct MEXCPriceFetcher;

impl Fetcher for MEXCPriceFetcher {
    type ParsedResponse = PairPriceData;
    type ApiResponse = MEXCPriceResponse;

    fn parse_response(&self, value: MEXCPriceResponse) -> Result<Self::ParsedResponse> {
        let response: PairPriceData = value
            .into_iter()
            .map(|value| (value.symbol, value.price))
            .collect();

        Ok(response)
    }
}

pub async fn get_mexc_prices() -> Result<PairPriceData> {
    let fetcher = MEXCPriceFetcher {};
    let req = fetcher.prepare_get_request("https://api.mexc.com/api/v3/ticker/price", None)?;
    let resp: Response = send(req).await?;
    let deserialized = fetcher.deserialize_response(resp)?;
    let pair_prices: PairPriceData = fetcher.parse_response(deserialized)?;

    Ok(pair_prices)
}
