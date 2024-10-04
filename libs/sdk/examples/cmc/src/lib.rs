use anyhow::Result;
use blocksense_sdk::{
    oracle::{DataFeedResult, Payload, Settings},
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
    // pub name: String,
    // pub symbol: String,
    // pub slug: String,
    // #[serde(rename = "num_market_pairs")]
    // pub num_market_pairs: Option<i64>,
    // #[serde(rename = "date_added")]
    // pub date_added: Option<String>,
    // pub tags: Vec<Tag>,
    // #[serde(rename = "max_supply")]
    // pub max_supply: Option<i64>,
    // #[serde(rename = "circulating_supply")]
    // pub circulating_supply: Option<f64>,
    // #[serde(rename = "total_supply")]
    // pub total_supply: Option<f64>,
    // #[serde(rename = "is_active")]
    // pub is_active: Option<f64>,
    // #[serde(rename = "infinite_supply")]
    // pub infinite_supply: Option<bool>,
    // pub platform: Value,
    // #[serde(rename = "cmc_rank")]
    // pub cmc_rank: Option<i64>,
    // #[serde(rename = "is_fiat")]
    // pub is_fiat: Option<i64>,
    // #[serde(rename = "self_reported_circulating_supply")]
    // pub self_reported_circulating_supply: Value,
    // #[serde(rename = "self_reported_market_cap")]
    // pub self_reported_market_cap: Value,
    // #[serde(rename = "tvl_ratio")]
    // pub tvl_ratio: Value,
    // #[serde(rename = "last_updated")]
    // pub last_updated: Option<String>,
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
    pub price: f64,
    // #[serde(rename = "volume_24h")]
    // pub volume_24h: Option<f64>,
    // #[serde(rename = "volume_change_24h")]
    // pub volume_change_24h: Option<f64>,
    // #[serde(rename = "percent_change_1h")]
    // pub percent_change_1h: Option<f64>,
    // #[serde(rename = "percent_change_24h")]
    // pub percent_change_24h: Option<f64>,
    // #[serde(rename = "percent_change_7d")]
    // pub percent_change_7d: Option<f64>,
    // #[serde(rename = "percent_change_30d")]
    // pub percent_change_30d: Option<f64>,
    // #[serde(rename = "percent_change_60d")]
    // pub percent_change_60d: Option<f64>,
    // #[serde(rename = "percent_change_90d")]
    // pub percent_change_90d: Option<f64>,
    // #[serde(rename = "market_cap")]
    // pub market_cap: Option<f64>,
    // #[serde(rename = "market_cap_dominance")]
    // pub market_cap_dominance: Option<f64>,
    // #[serde(rename = "fully_diluted_market_cap")]
    // pub fully_diluted_market_cap: Option<f64>,
    // pub tvl: Value,
    // #[serde(rename = "last_updated")]
    // pub last_updated: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CmcResource {
    pub cmc_id: u64,
    pub cmc_quote: String,
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    let mut resources: HashMap<String, CmcResource> = HashMap::new();
    let mut ids: Vec<String> = vec![];
    for feed in settings.data_feeds.iter() {
        let data: CmcResource = serde_json::from_str(&feed.data)?;
        resources.insert(feed.id.clone(), data.clone());
        ids.push(data.cmc_id.to_string());
    }

    let url = Url::parse_with_params(
        "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest",
        &[("id", ids.join(","))],
    )?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    //TODO(adikov): Implement API key as capability of the reporter and add it to the header
    //in the oracle trigger

    // Please provide your own API key until capabilities are implemented.
    req.header("X-CMC_PRO_API_KEY", "");
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let string = String::from_utf8(body)?;
    let value: Root = serde_json::from_str(&string)?;
    let mut payload: Payload = Payload::new();

    for (feed_id, data) in resources.iter() {
        payload.values.push(match value.data.get(&data.cmc_id) {
            Some(cmc) => DataFeedResult {
                id: feed_id.clone(),
                value: cmc
                    .quote
                    .get("USD")
                    .unwrap_or(&CmcValue { price: 0.0 })
                    .price,
            },
            None => {
                println!("CMC data feed with id {} is not found", data.cmc_id);
                //TODO: Start reporting error.
                DataFeedResult {
                    id: feed_id.clone(),
                    value: 0.0,
                }
            }
        });
    }

    Ok(payload)
}
