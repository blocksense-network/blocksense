use anyhow::Result;
use blocksense_sdk::spin::http::{send, Response};
use futures::stream::{FuturesUnordered, StreamExt};
use std::collections::HashMap;

use serde::Deserialize;

use crate::common::{Fetcher, PairPriceData};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct OKXInstrument {
    #[serde(rename = "instId")]
    pub inst_id: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct OKXInstrumentResponse {
    pub code: String,
    pub data: Vec<OKXInstrument>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct OKXTickerData {
    #[serde(rename = "instId")]
    pub inst_id: String,
    #[serde(rename = "idxPx")]
    pub idx_px: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct OKXTickerResponse {
    pub code: String,
    pub data: Vec<OKXTickerData>,
}

struct OKXSymbolsFetcher;

impl Fetcher for OKXSymbolsFetcher {
    type ParsedResponse = Vec<String>;
    type ApiResponse = OKXInstrumentResponse;

    fn parse_response(&self, value: OKXInstrumentResponse) -> Result<Self::ParsedResponse> {
        let response: Vec<String> = value
            .data
            .into_iter()
            .map(|symbol| symbol.inst_id)
            .collect();

        Ok(response)
    }
}

pub async fn get_okx_symbols() -> Result<Vec<String>> {
    let fetcher = OKXSymbolsFetcher {};
    let req = fetcher.prepare_get_request(
        "https://www.okx.com/api/v5/public/instruments?instType=SPOT",
        None,
    )?;
    let resp: Response = send(req).await?;
    let deserialized = fetcher.deserialize_response(resp)?;
    let symbols = fetcher.parse_response(deserialized)?;

    Ok(symbols)
}

struct OKXPriceFetcher;

impl Fetcher for OKXPriceFetcher {
    type ParsedResponse = (String, String);
    type ApiResponse = OKXTickerResponse;

    fn parse_response(&self, value: OKXTickerResponse) -> Result<Self::ParsedResponse> {
        let data = value.data.first().ok_or(anyhow::anyhow!("No data"))?;

        Ok((data.inst_id.clone(), data.idx_px.clone()))
    }
}

pub async fn fetch_okx_price(symbol: String) -> Option<(String, String)> {
    let fetcher = OKXPriceFetcher {};
    let url = format!(
        "https://www.okx.com/api/v5/market/index-tickers?instId={}",
        symbol
    );
    let req = fetcher.prepare_get_request(&url, None).ok()?;
    let response: Response = send(req).await.ok()?;
    if *response.status() != 200 {
        return None;
    }
    let deserialized = fetcher.deserialize_response(response).ok()?;
    let data = fetcher.parse_response(deserialized).ok()?;

    Some(data)
}

pub async fn get_okx_prices() -> Result<PairPriceData> {
    let symbols = get_okx_symbols().await?;

    let mut pair_prices: PairPriceData = HashMap::new();
    let mut futures = FuturesUnordered::new();

    // Spawn all fetches concurrently
    for symbol in symbols {
        futures.push(fetch_okx_price(symbol));
    }

    // Collect results as they complete
    while let Some(result) = futures.next().await {
        if let Some((symbol, price)) = result {
            pair_prices.insert(symbol.replace("-", ""), price);
        }
    }

    Ok(pair_prices)
}
