use anyhow::Result;
use blocksense_sdk::spin::http::{send, Method, Request, Response};
use std::collections::HashMap;

use serde::Deserialize;
use url::Url;

use crate::common::{fill_results, ResourceData, ResourceResult};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct UpBitMarketResponse {
    pub market: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct UpBitResponse {
    pub market: String,
    pub trade_price: f64,
}

pub async fn get_upbit_market() -> Result<Vec<String>> {
    let url = Url::parse("https://api.upbit.com/v1/market/all")?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let body_as_string = String::from_utf8(body)?;
    let markets_result: Vec<UpBitMarketResponse> = serde_json::from_str(&body_as_string)?;
    let markets = markets_result
        .iter()
        .map(|market| market.market.clone())
        .collect::<Vec<String>>();

    Ok(markets)
}

pub async fn get_upbit_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let markets = get_upbit_market().await?;
    let all_markets = markets.join(",");
    let url = Url::parse_with_params(
        "https://api.upbit.com/v1/ticker",
        &[("markets", all_markets.as_str())],
    )?;
    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let body_as_string = String::from_utf8(body)?;
    let prices: Vec<UpBitResponse> = serde_json::from_str(&body_as_string)?;

    let response: HashMap<String, String> = prices
        .into_iter()
        .map(|price| {
            let parts: Vec<&str> = price.market.split('-').collect();
            let transformed_market = format!("{}{}", parts[1], parts[0]);
            (transformed_market, price.trade_price.to_string())
        })
        .collect();

    fill_results(resources, results, response)?;

    Ok(())
}
