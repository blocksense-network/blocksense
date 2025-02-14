use anyhow::Result;
use blocksense_sdk::spin::http::{Method, Request, Response};
use serde::de::DeserializeOwned;
use std::collections::HashMap;
use url::Url;

pub const USD_SYMBOLS: [&str; 3] = ["USD", "USDC", "USDT"];

pub type PairPriceData = HashMap<String, String>;

#[derive(Debug)]
pub struct ResourceData {
    pub symbol: String,
    pub id: String,
}

#[derive(Debug)]
#[allow(dead_code)] // We are not using this struct yet.
pub struct ResourceResult {
    pub id: String,
    pub symbol: String,
    pub usd_symbol: String,
    pub result: String,
    //TODO(adikov): Add balance information when we start getting it.
}

pub fn fill_results(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
    response: HashMap<String, String>,
) -> Result<()> {
    //TODO(adikov): We need a proper way to get trade volume from Binance API.
    for resource in resources {
        // First USD pair found.
        for symbol in USD_SYMBOLS {
            let quote = format!("{}{}", resource.symbol, symbol);
            if response.contains_key(&quote) {
                //TODO(adikov): remove unwrap
                let res = results.entry(resource.id.clone()).or_default();
                res.push(ResourceResult {
                    id: resource.id.clone(),
                    symbol: resource.symbol.clone(),
                    usd_symbol: symbol.to_string(),
                    result: response.get(&quote).unwrap().clone(),
                });
                break;
            }
        }
    }

    Ok(())
}

pub trait Fetcher {
    type ParsedResponse;
    type ApiResponse: DeserializeOwned; // Ensure it's deserializable

    fn prepare_get_request(
        &self,
        base_url: &str,
        params: Option<&[(&str, &str)]>,
    ) -> Result<Request> {
        let url = match params {
            Some(p) => Url::parse_with_params(base_url, p)?,
            None => Url::parse(base_url)?,
        };

        let mut req = Request::builder();
        req.method(Method::Get);
        req.uri(url.as_str());
        req.header("Accepts", "application/json");

        Ok(req.build())
    }

    fn deserialize_response(&self, resp: Response) -> Result<Self::ApiResponse> {
        let body = resp.into_body();
        serde_json::from_slice(&body).map_err(|e| e.into())
    }

    fn parse_response(&self, response: Self::ApiResponse) -> Result<Self::ParsedResponse>;
}

#[derive(Default, Debug, Clone, PartialEq)]
pub struct PricePoint {
    price: f64,
    volume: f64,
}

#[allow(dead_code)]
type ExchangePricePoints = HashMap<String, PricePoint>;

#[allow(dead_code)]
fn wvap(exchange_price_points: &ExchangePricePoints) -> Result<f64> {
    if exchange_price_points.is_empty() {
        return Err(anyhow::anyhow!("No price points found"));
    }
    let numerator: f64 = exchange_price_points
        .iter()
        .fold(0.0, |acc, (_, price_point)| {
            acc + price_point.volume * price_point.price
        });
    let denominator: f64 = exchange_price_points
        .iter()
        .fold(0.0, |acc, (_, price_point)| acc + price_point.volume);

    Ok(numerator / denominator)
}
