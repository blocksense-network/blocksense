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

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Root {
    pub quote_response: QuoteResponse,
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
    // pub language: String,
    // pub region: String,
    // pub quote_type: String,
    // pub type_disp: String,
    // pub quote_source_name: String,
    // pub triggerable: bool,
    // pub custom_price_alert_confidence: String,
    // pub currency: Option<String>,
    // pub fifty_two_week_low: Option<f64>,
    // pub fifty_two_week_high: Option<f64>,
    // pub fifty_day_average: Option<f64>,
    // pub two_hundred_day_average: Option<f64>,
    // pub regular_market_change: Option<f64>,
    // pub regular_market_day_high: Option<f64>,
    // pub regular_market_day_low: Option<f64>,
    // pub bid: Option<f64>,
    // pub ask: Option<f64>,
    // pub regular_market_open: Option<f64>,
    // pub short_name: Option<String>,
    // pub long_name: Option<String>,
    // pub regular_market_change_percent: Option<f64>,
    // pub has_pre_post_market_data: bool,
    // pub first_trade_date_milliseconds: i64,
    // pub fifty_two_week_low_change_percent: Option<f64>,
    // pub fifty_two_week_range: String,
    // pub fifty_two_week_high_change: Option<f64>,
    // pub fifty_two_week_high_change_percent: Option<f64>,
    // pub fifty_two_week_change_percent: f64,
    // pub fifty_day_average_change: Option<f64>,
    // pub fifty_day_average_change_percent: Option<f64>,
    // pub two_hundred_day_average_change: Option<f64>,
    // pub two_hundred_day_average_change_percent: Option<f64>,
    // pub source_interval: i64,
    // pub exchange_data_delayed_by: i64,
    // pub regular_market_time: Option<i64>,
    // pub regular_market_day_range: Option<String>,
    // pub regular_market_volume: Option<i64>,
    // pub bid_size: Option<i64>,
    // pub ask_size: Option<i64>,
    // pub full_exchange_name: String,
    // #[serde(rename = "averageDailyVolume3Month")]
    // pub average_daily_volume3month: i64,
    // #[serde(rename = "averageDailyVolume10Day")]
    // pub average_daily_volume10day: i64,
    // pub fifty_two_week_low_change: Option<f64>,
    // pub market_state: String,
    // pub exchange: String,
    // pub message_board_id: Option<String>,
    // pub exchange_timezone_name: String,
    // pub exchange_timezone_short_name: String,
    // pub gmt_off_set_milliseconds: i64,
    // pub market: String,
    // pub esg_populated: bool,
    // pub tradeable: bool,
    // pub crypto_tradeable: bool,
    // pub price_hint: i64,
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
    req.header("x-api-key", "");
    req.header("Accepts", "application/json");

    let req = req.build();
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let string = String::from_utf8(body)?;
    let mut value: Root = serde_json::from_str(&string)?;

    let mut payload: Payload = Payload::new();

    for (feed_id, data) in resources.iter() {
        let position = value
            .quote_response
            .result
            .iter()
            .position(|yahoo_result| data.yf_symbol == yahoo_result.symbol);
        payload.values.push(match position {
            Some(index) => {
                let yahoo = value.quote_response.result.swap_remove(index);
                DataFeedResult {
                    id: feed_id.clone(),
                    value: yahoo
                        .regular_market_price
                        .unwrap_or(yahoo.regular_market_previous_close.unwrap_or(0.0)),
                }
            }
            None => {
                println!(
                    "Yahoo data feed with symbol {} is not found",
                    data.yf_symbol
                );
                //TODO: Start reporting error.
                DataFeedResult {
                    id: feed_id.clone(),
                    value: 0.0,
                }
            }
        });
    }

    for yahoo in value.quote_response.result.iter() {
        println!(
            "Yahoo response with symbol {} wasn't consumed",
            yahoo.symbol
        );
    }

    Ok(payload)
}
