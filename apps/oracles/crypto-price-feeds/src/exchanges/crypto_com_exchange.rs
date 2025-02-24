use anyhow::{Ok, Result};
use blocksense_sdk::spin::http::{send, Response};

use serde::Deserialize;

use crate::common::{Fetcher, PairPriceData};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CryptoComPriceData {
    pub i: String,
    pub a: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CryptoComResult {
    pub data: Vec<CryptoComPriceData>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CryptoComPriceResponse {
    pub code: i8,
    pub result: CryptoComResult,
}

struct CryptoComPriceFetcher;

impl Fetcher for CryptoComPriceFetcher {
    type ParsedResponse = PairPriceData;
    type ApiResponse = CryptoComPriceResponse;

    fn parse_response(&self, value: CryptoComPriceResponse) -> Result<Self::ParsedResponse> {
        let response: PairPriceData = value
            .result
            .data
            .into_iter()
            //  we should consider what to do with perp
            .filter(|value| !value.i.contains("-PERP"))
            .map(|value| (value.i.replace("_", ""), value.a))
            .collect();

        Ok(response)
    }
}

pub async fn get_crypto_com_exchange_prices() -> Result<PairPriceData> {
    let fetcher = CryptoComPriceFetcher {};
    let req = fetcher.prepare_get_request(
        "https://api.crypto.com/exchange/v1/public/get-tickers",
        None,
    );
    let resp: Response = send(req?).await?;
    let deserialized = fetcher.deserialize_response(resp)?;
    let pair_prices: PairPriceData = fetcher.parse_response(deserialized)?;

    Ok(pair_prices)
}
