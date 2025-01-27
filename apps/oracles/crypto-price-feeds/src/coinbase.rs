use anyhow::Result;
use blocksense_sdk::spin::http::{send, Method, Request, Response};
use std::collections::HashMap;

use serde::Deserialize;
use url::Url;

use crate::common::{ResourceData, ResourceResult};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CoinbaseData {
    pub currency: String,
    pub rates: HashMap<String, String>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CoinbaseResponse {
    pub data: CoinbaseData,
}

#[allow(dead_code)] // We are not using this func yet.
async fn get_coinbase_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let url = Url::parse_with_params(
        "https://api.coinbase.com/v2/exchange-rates",
        &[("currency", "USD")],
    )?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let string = String::from_utf8(body)?;
    let value: CoinbaseResponse = serde_json::from_str(&string)?;

    for resource in resources {
        if value.data.rates.contains_key(&resource.symbol) {
            //TODO(adikov): remove unwrap
            let res = results.entry(resource.id.clone()).or_default();
            res.push(ResourceResult {
                id: resource.id.clone(),
                symbol: resource.symbol.clone(),
                usd_symbol: resource.symbol.to_string(),
                result: value.data.rates.get(&resource.symbol).unwrap().clone(),
            });
        }
    }

    Ok(())
}
