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
struct BitgetFetcher;

impl Fetcher for BitgetFetcher {
    type ParsedResponse = PairPriceData;
    type ApiResponse = BitgetPriceResponse;

    fn parse_response(&self, value: BitgetPriceResponse) -> Result<Self::ParsedResponse> {
        let response: Self::ParsedResponse = value
            .data
            .into_iter()
            .map(|value| (value.symbol, value.close))
            .collect();

        Ok(response)
    }
}

pub async fn get_bitget_prices() -> Result<PairPriceData> {
    let fetcher = BitgetFetcher {};
    let req =
        fetcher.prepare_get_request("https://api.bitget.com/api/spot/v1/market/tickers", None);
    let resp: Response = send(req?).await?;
    let deserialized = fetcher.deserialize_response(resp)?;
    let pair_prices: PairPriceData = fetcher.parse_response(deserialized)?;

    Ok(pair_prices)
}
