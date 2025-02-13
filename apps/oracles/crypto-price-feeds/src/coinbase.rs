use anyhow::Result;
use blocksense_sdk::spin::http::{send, Response};
use std::collections::HashMap;

use serde::Deserialize;

use crate::common::{Fetcher, PairPriceData};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CoinbasePriceData {
    pub currency: String,
    pub rates: HashMap<String, String>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CoinbasePriceResponse {
    pub data: CoinbasePriceData,
}

struct CoinbasePriceFetcher;

impl Fetcher for CoinbasePriceFetcher {
    type ParsedResponse = PairPriceData;
    type ApiResponse = CoinbasePriceResponse;

    fn parse_response(&self, value: CoinbasePriceResponse) -> Result<Self::ParsedResponse> {
        let response: Self::ParsedResponse = value
            .data
            .rates
            .into_iter()
            .filter_map(|(asset, price)| match price.parse::<f64>() {
                Ok(price_as_number) => {
                    let price = (1.0 / price_as_number).to_string();
                    let pair = format!("{}{}", asset, "USD");
                    Some((pair, price))
                }
                Err(_) => None,
            })
            .collect();

        Ok(response)
    }
}

pub async fn get_coinbase_prices() -> Result<PairPriceData> {
    let fetcher = CoinbasePriceFetcher {};
    let req = fetcher.prepare_get_request(
        "https://api.coinbase.com/v2/exchange-rates",
        Some(&[("currency", "USD")]),
    );
    let resp: Response = send(req?).await?;
    let deserialiazed = fetcher.deserialize_response(resp)?;
    let pair_prices: PairPriceData = fetcher.parse_response(deserialiazed)?;

    Ok(pair_prices)
}
