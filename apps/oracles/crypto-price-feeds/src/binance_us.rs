use anyhow::Result;
use blocksense_sdk::spin::http::{send, Response};

use serde::Deserialize;

use crate::common::{Fetcher, PairPriceData};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BinanceUsPriceData {
    pub symbol: String,
    pub price: String,
}

type BinanceUsPriceResponse = Vec<BinanceUsPriceData>;

struct BinanceUsPriceFetcher;

impl Fetcher for BinanceUsPriceFetcher {
    type ParsedResponse = PairPriceData;
    type ApiResponse = BinanceUsPriceResponse;

    fn parse_response(&self, value: BinanceUsPriceResponse) -> Result<Self::ParsedResponse> {
        let response: Self::ParsedResponse = value
            .into_iter()
            .filter(|value| !value.symbol.ends_with("USD"))
            .map(|value| (value.symbol, value.price))
            .collect();

        Ok(response)
    }
}

pub async fn get_binance_us_prices() -> Result<PairPriceData> {
    let fetcher = BinanceUsPriceFetcher {};
    let req = fetcher.prepare_get_request("https://api.binance.us/api/v3/ticker/price", None);
    let resp: Response = send(req?).await?;
    let deserialized = fetcher.deserialize_response(resp)?;
    let pair_prices: PairPriceData = fetcher.parse_response(deserialized)?;

    Ok(pair_prices)
}
