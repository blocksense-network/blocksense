use anyhow::Result;
use blocksense_sdk::spin::http::{send, Method, Request, Response};
use std::collections::HashMap;

use serde::Deserialize;
use url::Url;

use crate::common::{fill_results, ResourceData, ResourceResult};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BinanceUsPrice {
    pub symbol: String,
    pub price: String,
}

// Binance US provides wrong price for pair BTC/USD. For the USDT stable coin the price is correct.
// It might mean other pairs with fiat quote might be incorrect
pub async fn get_binance_us_prices(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
) -> Result<()> {
    let url = Url::parse("https://api.binance.us/api/v3/ticker/price")?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let string = String::from_utf8(body)?;
    let values: Vec<BinanceUsPrice> = serde_json::from_str(&string)?;
    let response: HashMap<String, String> = values
        .into_iter()
        .map(|value| (value.symbol, value.price))
        .collect();

    fill_results(resources, results, response)?;

    Ok(())
}
