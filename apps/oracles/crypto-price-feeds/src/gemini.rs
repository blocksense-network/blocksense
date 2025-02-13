use anyhow::Result;
use blocksense_sdk::spin::http::{send, Response};
use futures::stream::{FuturesUnordered, StreamExt};
use std::collections::HashMap;

use serde::Deserialize;

use crate::common::{Fetcher, PairPriceData};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct GeminiPriceResponse {
    pub last: String,
}

type GeminiSymbolsResponse = Vec<String>;

struct GeminiSymbolsFetcher;

impl Fetcher for GeminiSymbolsFetcher {
    type ParsedResponse = Vec<String>;
    type ApiResponse = GeminiSymbolsResponse;

    fn parse_response(&self, value: GeminiSymbolsResponse) -> Result<Self::ParsedResponse> {
        let response: Vec<String> = value
            .into_iter()
            .filter(|symbol| !symbol.ends_with("perp"))
            .map(|symbol| symbol.to_ascii_uppercase())
            .collect();

        Ok(response)
    }
}

pub async fn get_gemini_symbols() -> Result<Vec<String>> {
    let fetcher = GeminiSymbolsFetcher {};
    let req = fetcher.prepare_get_request("https://api.gemini.com/v1/symbols", None)?;
    let resp: Response = send(req).await?;
    let deserialized = fetcher.deserialize_response(resp)?;
    let symbols = fetcher.parse_response(deserialized)?;

    Ok(symbols)
}

struct GeminiPriceFetcher;

impl Fetcher for GeminiPriceFetcher {
    type ParsedResponse = String;
    type ApiResponse = GeminiPriceResponse;

    fn parse_response(&self, value: GeminiPriceResponse) -> Result<Self::ParsedResponse> {
        Ok(value.last)
    }
}
pub async fn fetch_gemini_price(symbol: String) -> Option<(String, String)> {
    let fetcher = GeminiPriceFetcher {};
    let url = format!("https://api.gemini.com/v1/pubticker/{}", symbol);
    let req = fetcher.prepare_get_request(&url, None);
    let response: Response = send(req.ok()?).await.ok()?;
    if *response.status() != 200 {
        return None;
    }
    let deserialized = fetcher.deserialize_response(response).ok();
    let price = fetcher.parse_response(deserialized?).ok();
    Some((symbol, price?))
}

pub async fn get_gemini_prices() -> Result<PairPriceData> {
    let symbols = get_gemini_symbols().await?;

    let mut pair_prices: PairPriceData = HashMap::new();
    let mut futures = FuturesUnordered::new();

    // Spawn all fetches concurrently
    for symbol in symbols {
        futures.push(fetch_gemini_price(symbol));
    }

    // Collect results as they complete
    while let Some(result) = futures.next().await {
        if let Some((symbol, price)) = result {
            pair_prices.insert(symbol, price);
        }
    }

    Ok(pair_prices)
}
