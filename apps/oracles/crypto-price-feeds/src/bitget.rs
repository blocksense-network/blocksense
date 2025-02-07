use anyhow::Result;
use blocksense_sdk::spin::http::{send, Method, Request, Response};
use std::collections::HashMap;

use serde::Deserialize;
use url::Url;

use crate::common::{fill_results, ResourceData, ResourceResult};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BitgetPrice {
    pub symbol: String,
    pub close: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BitgetResponse {
    pub code: String,
    pub data: Vec<BitgetPrice>,
}

pub async fn get_bitget_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let url = Url::parse("https://api.bitget.com/api/spot/v1/market/tickers")?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let body_as_string = String::from_utf8(body)?;
    let value: BitgetResponse = serde_json::from_str(&body_as_string)?;

    let response: HashMap<String, String> = value
        .data
        .into_iter()
        .map(|value| (value.symbol, value.close))
        .collect();

    fill_results(resources, results, response)?;

    Ok(())
}
