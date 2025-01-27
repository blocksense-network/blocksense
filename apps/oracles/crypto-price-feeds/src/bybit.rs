use anyhow::Result;
use blocksense_sdk::spin::http::{send, Method, Request, Response};
use std::collections::HashMap;

use serde::Deserialize;
use url::Url;

use crate::common::{fill_results, ResourceData, ResourceResult};

//TODO(adikov): Include all the needed fields form the response like volume.
#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BybitPrice {
    pub symbol: String,
    pub last_price: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BybitResult {
    pub category: String,
    pub list: Vec<BybitPrice>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BybitResponse {
    pub ret_code: u32,
    pub ret_msg: String,
    pub result: BybitResult,
}

pub async fn get_bybit_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let url = Url::parse_with_params(
        "https://api.bybit.com/v5/market/tickers",
        &[("category", "spot"), ("symbols", "")],
    )?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let string = String::from_utf8(body)?;
    let value: BybitResponse = serde_json::from_str(&string)?;
    let response: HashMap<String, String> = value
        .result
        .list
        .into_iter()
        .map(|value| (value.symbol, value.last_price))
        .collect();

    fill_results(resources, results, response)?;

    Ok(())
}
