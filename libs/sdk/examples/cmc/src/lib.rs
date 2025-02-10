use anyhow::{Context, Result};
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
    spin::http::{send, Method, Request, Response},
};
use std::collections::HashMap;

use serde::Deserialize;
use serde_json::Value;
use url::Url;

#[allow(dead_code)]
#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Root {
    pub status: Status,
    #[serde(default)]
    pub data: HashMap<u64, CmcData>,
}

#[allow(dead_code)]
#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub timestamp: String,
    #[serde(rename = "error_code")]
    pub error_code: i64,
    #[serde(rename = "error_message")]
    pub error_message: Value,
    pub elapsed: i64,
    #[serde(rename = "credit_count")]
    pub credit_count: i64,
    pub notice: Value,
}

#[allow(dead_code)]
#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CmcData {
    id: i64,
    quote: HashMap<String, CmcValue>,
}

#[allow(dead_code)]
#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub slug: String,
    pub name: String,
    pub category: String,
}

#[allow(dead_code)]
#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CmcValue {
    pub price: Option<f64>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CmcResource {
    pub cmc_id: String,
    pub cmc_quote: String,
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    let mut resources: HashMap<String, CmcResource> = HashMap::new();
    let mut ids: Vec<String> = vec![];
    for feed in settings.data_feeds.iter() {
        let data: CmcResource = serde_json::from_str(&feed.data).context("Couldn't parse Data Feed resource properly")?;
        resources.insert(feed.id.clone(), data.clone());
        ids.push(data.cmc_id);
    }

    let url = Url::parse_with_params(
        "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest",
        &[("id", ids.join(","))],
    )?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);

    // Please provide your own API key until capabilities are implemented.
    req.header(
        "X-CMC_PRO_API_KEY",
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
    let value: Root = serde_json::from_str(&string).context("Couldn't parse CMC response properly")?;
    let mut payload: Payload = Payload::new();

    for (feed_id, data) in resources.iter() {
        payload.values.push(match value.data.get(&data.cmc_id.parse::<u64>()?) {
            Some(cmc) => {
                let value = if let Some(&CmcValue { price: Some(price) }) = cmc.quote.get("USD") {
                    DataFeedResultValue::Numerical(price)
                } else {
                    DataFeedResultValue::Error(format!(
                        "No price in USD for data feed with id {}",
                        data.cmc_id
                    ))
                };

                DataFeedResult {
                    id: feed_id.clone(),
                    value,
                }
            }
            None => {
                let error = if value.status.error_code == 0 {
                        format!("CMC data feed with id {} is not found", data.cmc_id)
                    } else {
                        println!("CMC returned error with code = {} message = {}", value.status.error_code, value.status.error_message);
                        value.status.error_message.to_string()
                    };
                DataFeedResult {
                    id: feed_id.clone(),
                    value: DataFeedResultValue::Error(error),
                }
            }
        });
    }

    Ok(payload)
}
