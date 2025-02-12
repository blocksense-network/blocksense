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

struct BinancePriceFetcher;

impl Fetcher for BinancePriceFetcher {
    type ParsedResponse = PairPriceData;
    type ApiResponse = BinancePriceResponse;

    fn parse_response(&self, value: BinancePriceResponse) -> Result<Self::ParsedResponse> {
        let response: Self::ParsedResponse = value
            .into_iter()
            .map(|value| (value.symbol, value.price))
            .collect();

        Ok(response)
    }
}

pub async fn get_binance_prices() -> Result<PairPriceData> {
    let fetcher = BinancePriceFetcher {};
    let req = fetcher.prepare_get_request("https://api.binance.com/api/v3/ticker/price", None);
    let resp: Response = send(req?).await?;
    let deserialized = fetcher.deserialize_response(resp)?;
    let pair_prices: PairPriceData = fetcher.parse_response(deserialized)?;

    Ok(pair_prices)
}
