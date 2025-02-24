use anyhow::Result;
use blocksense_sdk::spin::http::{send, Response};
use serde::Deserialize;

use crate::common::{Fetcher, PairPriceData};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct UpBitMarketResponseData {
    pub market: String,
}

type UpBitMarketResponse = Vec<UpBitMarketResponseData>;

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct UpBitTickerResponseData {
    pub market: String,
    pub trade_price: f64,
}

type UpBitResponse = Vec<UpBitTickerResponseData>;

struct UpBitMarketFetcher;

impl Fetcher for UpBitMarketFetcher {
    type ParsedResponse = Vec<String>;
    type ApiResponse = UpBitMarketResponse;

    fn parse_response(&self, value: UpBitMarketResponse) -> Result<Self::ParsedResponse> {
        let markets = value
            .iter()
            .map(|market| market.market.clone())
            .collect::<Self::ParsedResponse>();

        Ok(markets)
    }
}

pub async fn get_upbit_market() -> Result<Vec<String>> {
    let fetcher = UpBitMarketFetcher {};
    let req = fetcher.prepare_get_request("https://api.upbit.com/v1/market/all", None);
    let resp: Response = send(req?).await?;

    let deserialized = fetcher.deserialize_response(resp)?;
    let markets = fetcher.parse_response(deserialized)?;

    Ok(markets)
}

struct UpBitPricesFetcher;

impl Fetcher for UpBitPricesFetcher {
    type ParsedResponse = PairPriceData;
    type ApiResponse = UpBitResponse;

    fn parse_response(&self, value: UpBitResponse) -> Result<Self::ParsedResponse> {
        let response: PairPriceData = value
            .into_iter()
            .map(|price| {
                let parts: Vec<&str> = price.market.split('-').collect();
                let transformed_market = format!("{}{}", parts[1], parts[0]);
                (transformed_market, price.trade_price.to_string())
            })
            .collect();

        Ok(response)
    }
}

pub async fn get_upbit_prices() -> Result<PairPriceData> {
    let markets = get_upbit_market().await?;
    let all_markets = markets.join(",");

    let fetcher = UpBitPricesFetcher {};
    let req = fetcher.prepare_get_request(
        "https://api.upbit.com/v1/ticker",
        Some(&[("markets", all_markets.as_str())]),
    );
    let resp: Response = send(req?).await?;
    let deserialized = fetcher.deserialize_response(resp)?;
    let pair_prices: PairPriceData = fetcher.parse_response(deserialized)?;

    Ok(pair_prices)
}
