use anyhow::{Context, Result};
use blocksense_sdk::spin::http::{send, Method, Request, Response};
use std::collections::HashMap;

use serde::Deserialize;
use serde_json::Value;
use url::Url;

use crate::common::{fill_results, ResourceData, ResourceResult};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KrakenPrice {
    pub a: Vec<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KrakenResponse {
    pub error: Vec<Value>,
    pub result: HashMap<String, KrakenPrice>,
}

pub async fn get_kraken_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let url = Url::parse("https://api.kraken.com/0/public/Ticker")?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let string = String::from_utf8(body)?;
    let value: KrakenResponse = serde_json::from_str(&string)?;
    let mut response: HashMap<String, String> = HashMap::new();
    for (symbol, price) in value.result {
        response.insert(
            symbol.clone(),
            price
                .a
                .first()
                .context(format!(
                    "Kraken has no price in response for symbol: {}",
                    symbol
                ))?
                .clone(),
        );
    }

    fill_results(resources, results, response)?;

    Ok(())
}
