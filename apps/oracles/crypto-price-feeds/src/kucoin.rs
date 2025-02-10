use anyhow::Result;
use blocksense_sdk::spin::http::{send, Response};

use serde::Deserialize;

use crate::common::{Fetcher, PairPriceData};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KuCoinPrice {
    pub symbol: String,
    pub last: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KuCoinResult {
    pub ticker: Vec<KuCoinPrice>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KuCoinResponse {
    pub code: String,
    pub data: KuCoinResult,
}

struct KuCoinFetcher;

impl Fetcher for KuCoinFetcher {
    type ParsedResponse = PairPriceData;
    type ApiResponse = KuCoinResponse;

    fn parse_response(&self, value: KuCoinResponse) -> Result<Self::ParsedResponse> {
        let response: Self::ParsedResponse = value
            .data
            .ticker
            .into_iter()
            .filter(|value| value.last.is_some())
            // KuCoin have symbols in format "X-Y". We need to match logic in `fill_results`
            .map(|value| (value.symbol.replace("-", ""), value.last.unwrap()))
            .collect();

        Ok(response)
    }
}

pub async fn get_kucoin_prices() -> Result<PairPriceData> {
    let fetcher = KuCoinFetcher {};
    let req = fetcher.prepare_get_request("https://api.kucoin.com/api/v1/market/allTickers", None);
    let resp: Response = send(req?).await?;
    let deserialized = fetcher.deserialize_response(resp)?;
    let pair_prices: PairPriceData = fetcher.parse_response(deserialized)?;

    Ok(pair_prices)
}
