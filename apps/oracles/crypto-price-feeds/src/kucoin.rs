use anyhow::Result;
use blocksense_sdk::spin::http::{send, Method, Request, Response};
use std::collections::HashMap;

use serde::Deserialize;
use url::Url;

use crate::common::{fill_results, ResourceData, ResourceResult};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KuCoinPrice {
    pub symbol: String,
    pub last: String,
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

pub async fn get_kucoin_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let url = Url::parse("https://api.kucoin.com/api/v1/market/allTickers")?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let body_as_string = String::from_utf8(body)?;
    let value: KuCoinResponse = serde_json::from_str(&body_as_string)?;

    let response: HashMap<String, String> = value
        .data
        .ticker
        .into_iter()
        // KuCoin have symbols in format "X-Y". We need to match logic in `fill_results`
        .map(|value| (value.symbol.replace("-", ""), value.last))
        .collect();

    fill_results(resources, results, response)?;

    Ok(())
}
