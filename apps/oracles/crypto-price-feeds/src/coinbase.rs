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

pub async fn get_coinbase_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
    currency: String,
) -> Result<()> {
    let url = Url::parse_with_params(
        "https://api.coinbase.com/v2/exchange-rates",
        &[("currency", currency)],
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
            let res = results.entry(resource.id.clone()).or_default();

            // Since the endpoint we currently use give us the price of 1 USD in the given currency
            // we need to invert the price to get the price of 1 unit of the given currency in USD.
            let rate = match value.data.rates.get(&resource.symbol) {
                Some(rate) => rate,
                None => continue,
            };
            let price_as_number: f64 = rate.parse()?;
            let price: String = (1.0 / price_as_number).to_string();

            res.push(ResourceResult {
                id: resource.id.clone(),
                symbol: resource.symbol.clone(),
                usd_symbol: resource.symbol.to_string(),
                result: price,
            });
        }
    }

    Ok(())
}
