use anyhow::Result;
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
    spin::http::{send, Method, Request, Response},
};
use std::collections::HashMap;

use serde::Deserialize;
use serde_json::Value;
use url::Url;

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Root {
    pub quote_response: Option<QuoteResponse>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteResponse {
    pub result: Vec<YahooResult>,
    pub error: Value,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YahooResult {
    pub regular_market_previous_close: Option<f64>,
    pub regular_market_price: Option<f64>,
    pub symbol: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct YahooResource {
    pub yf_symbol: String,
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    let mut resources: HashMap<String, YahooResource> = HashMap::new();
    let mut ids: Vec<String> = vec![];
    for feed in settings.data_feeds.iter() {
        let data: YahooResource = serde_json::from_str(&feed.data)?;
        resources.insert(feed.id.clone(), data.clone());
        ids.push(data.yf_symbol.clone());
    }

    let url = Url::parse_with_params(
        "https://yfapi.net/v6/finance/quote",
        &[("symbols", ids.join(","))],
    )?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    //TODO(adikov): Implement API key as capability of the reporter and add it to the header
    //in the oracle trigger

    // Please provide your own API key until capabilities are implemented.
    req.header(
        "x-api-key",
        settings
            .capabilities
            .first()
            .expect("We expect only one capability.")
            .data
            .clone(),
    );
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let string = String::from_utf8(body)?;
    let value: Root = serde_json::from_str(&string)?;

    let mut payload: Payload = Payload::new();
    let mut quote_response = value
        .quote_response
        .ok_or(anyhow::anyhow!("No Yahoo response."))?;

    for (feed_id, data) in resources.iter() {
        let position = quote_response
            .result
            .iter()
            .position(|yahoo_result| data.yf_symbol == yahoo_result.symbol);
        payload.values.push(match position {
            Some(index) => {
                let yahoo = quote_response.result.swap_remove(index);
                let value = if let Some(price) = yahoo.regular_market_price {
                    DataFeedResultValue::Numerical(price)
                } else if let Some(price) = yahoo.regular_market_previous_close {
                    DataFeedResultValue::Numerical(price)
                } else {
                    DataFeedResultValue::Error(format!(
                        "No price for data feed with id {}",
                        feed_id
                    ))
                };
                DataFeedResult {
                    id: feed_id.clone(),
                    value,
                }
            }
            None => {
                let error = format!(
                    "Yahoo data feed with symbol {} is not found",
                    data.yf_symbol
                );
                //TODO: Start reporting error.
                DataFeedResult {
                    id: feed_id.clone(),
                    value: DataFeedResultValue::Error(error),
                }
            }
        });
    }

    for yahoo in quote_response.result.iter() {
        println!(
            "Yahoo response with symbol {} wasn't consumed",
            yahoo.symbol
        );
    }

    Ok(payload)
}
