use anyhow::Result;
use blocksense_sdk::spin::http::{send, Method, Request, Response};
use std::collections::HashMap;

use serde::Deserialize;
use url::Url;

use crate::common::{fill_results, ResourceData, ResourceResult};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CryptoComExchangePrice {
    pub i: String,
    pub a: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CryptoComExchangeResult {
    pub data: Vec<CryptoComExchangePrice>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CryptoComExchangeResponse {
    pub code: i8,
    pub result: CryptoComExchangeResult,
}

pub async fn get_crypto_com_exchange_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let url = Url::parse("https://api.crypto.com/exchange/v1/public/get-tickers")?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let body_as_string = String::from_utf8(body)?;
    let value: CryptoComExchangeResponse = serde_json::from_str(&body_as_string)?;

    let response: HashMap<String, String> = value
        .result
        .data
        .into_iter()
        //  we should consider what to do with perp
        .filter(|value| !value.i.contains('-'))
        .map(|value| (value.i.replace("_", ""), value.a))
        .collect();

    fill_results(resources, results, response)?;

    Ok(())
}
