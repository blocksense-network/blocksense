use std::collections::HashMap;
use std::result::Result;
use std::time::Duration;

use anyhow::anyhow;
use async_trait::async_trait;
use feed_registry::types::Asset;
use reqwest::blocking::Client;
use ringbuf::storage::Heap;
use ringbuf::traits::RingBuffer;
use ringbuf::{HeapRb, SharedRb};
use serde_json::Value;
use tracing::{debug, error, trace};
use utils::read_file;
use utils::{get_env_var, time::current_unix_time};

extern crate derive;
use derive::{ApiConnect, Historical};

use crate::interfaces::{api_connect::ApiConnect, data_feed::DataFeed, historical::Historical};
use crate::services::common::get_generic_feed_error;
use feed_registry::{
    aggregate::FeedAggregate,
    api::DataFeedAPI,
    types::{FeedResult, FeedType, Timestamp},
};

#[derive(ApiConnect, Historical)]
pub struct YahooFinanceDataFeed {
    client: Client,
    api_key: String,
    is_connected: bool,
    history_buffer: HeapRb<(FeedType, Timestamp)>,
}

impl YahooFinanceDataFeed {
    pub fn new(api_key_path: String) -> Self {
        Self {
            client: Client::new(),
            is_connected: true,
            api_key: read_file(api_key_path.as_str()),
            history_buffer: HeapRb::<(FeedType, Timestamp)>::new(
                get_env_var("HISTORY_BUFFER_SIZE").unwrap_or(10_000),
            ),
        }
    }
}

fn get_yf_json_price(yf_response: &Value, idx: usize, asset: &str) -> Result<f64, anyhow::Error> {
    let symbol = yf_response
        .get("quoteResponse")
        .and_then(|quote_response| quote_response.get("result"))
        .and_then(|response| response.get(idx))
        .and_then(|idx| idx.get("symbol"))
        .and_then(|symbol| symbol.as_str())
        .ok_or_else(|| anyhow!("Ticker not found or is not a valid string!"))?;

    let type_displayed = yf_response
        .get("quoteResponse")
        .and_then(|quote_response| quote_response.get("result"))
        .and_then(|response| response.get(idx))
        .and_then(|idx| idx.get("typeDisp"))
        .and_then(|result_type| result_type.as_str())
        .ok_or_else(|| anyhow!("Quote displayed type not found or is not a valid string!"))?;

    trace!("yf_symbol: {}, asset: {}", symbol, asset);

    if (symbol == asset) ||  // Check if symbol matches asset name
    (format!("{}USD=X", asset) == symbol && (type_displayed == "Currency" || type_displayed == "Fiat" || type_displayed.is_empty()))
    // Different syntax for Currency/Fiat pairs
    {
        let price = yf_response
            .get("quoteResponse")
            .and_then(|quote_response| quote_response.get("result"))
            .and_then(|response| response.get(idx))
            .and_then(|idx| idx.get("regularMarketPrice"))
            .and_then(|price| price.as_f64())
            .ok_or_else(|| anyhow!("Price not found or is not a valid f64!"))?;

        debug!("yf_symbol: {:?} yf_price = {:?}", symbol, price);

        Ok(price)
    } else {
        Err(anyhow!("Symbol doesnt match asset name from config!"))
    }
}

fn get_feed_result(response_json: &Value, idx: usize, asset: &str) -> FeedResult {
    let price = get_yf_json_price(&response_json.clone(), idx, asset);

    match price {
        Ok(price) => Ok(FeedType::Numerical(price)),
        Err(e) => {
            error!(
                "{}",
                format!("Error occured while getting {} price! - {}", asset, e)
            );

            Err(get_generic_feed_error("YahooFinance"))
        }
    }
}

fn get_feed_result_from_hashmap(asset: &str, map: &HashMap<String, f64>) -> FeedResult {
    match map.get(asset) {
        Some(&price) => Ok(FeedType::Numerical(price)),
        None => {
            error!(
                "{}",
                format!("Error occured while getting {} price!", asset)
            );

            Err(get_generic_feed_error("YahooFinance"))
        }
    }
}

#[async_trait]
impl DataFeed for YahooFinanceDataFeed {
    fn score_by(&self) -> FeedAggregate {
        FeedAggregate::AverageAggregator
    }

    fn poll(&mut self, asset: &str) -> (FeedResult, Timestamp) {
        let url = "https://yfapi.net/v6/finance/quote";

        let full_url = format!("{}?symbols={}", url, asset);

        debug!("Request url - {}", full_url);

        let headers = {
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                "x-api-key",
                reqwest::header::HeaderValue::from_str(self.api_key.as_str().trim()).unwrap(),
            );
            headers.insert(
                "Accept",
                reqwest::header::HeaderValue::from_static("application/json"),
            );
            headers
        };

        let response = self
            .client
            .get(full_url)
            .timeout(Duration::from_secs(60))
            .headers(headers)
            .send();

        if let Ok(response) = response {
            if response.status().is_success() {
                let resp_json: Value = response.json().unwrap();

                (get_feed_result(&resp_json, 0, asset), current_unix_time())
            } else {
                error!("Request failed with status: {}", response.status());

                (
                    Err(get_generic_feed_error("YahooFinance")),
                    current_unix_time(),
                )
            }
        } else {
            //TODO(snikolov): Figure out how to handle the Error if it occurs
            error!("Request failed with error");

            (
                Err(get_generic_feed_error("YahooFinance")),
                current_unix_time(),
            )
        }
    }

    async fn poll_batch(&mut self, asset_id_vec: &[Asset]) -> Vec<(FeedResult, u32, Timestamp)> {
        let url = "https://yfapi.net/v6/finance/quote";

        let asset_id_vec: Vec<(String, u32)> = asset_id_vec
            .iter()
            .map(|asset| {
                (
                    asset
                        .resources
                        .get("yf_symbol")
                        .unwrap_or_else(|| {
                            panic!(
                                "[YahooFinance] Missing resource `yf_symbol` in feed - {:?}",
                                asset.feed_id
                            )
                        })
                        .clone(),
                    asset.feed_id,
                )
            })
            .collect();

        let assets: Vec<String> = asset_id_vec.iter().map(|(s, _)| s.clone()).collect();

        let joined_symbols = assets.join(",");
        let full_url = format!("{}?symbols={}", url, joined_symbols);

        debug!("Request url - {}", full_url);
        debug!("All YahooFinance symbols - {}", joined_symbols);

        let headers = {
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                "x-api-key",
                reqwest::header::HeaderValue::from_str(self.api_key.as_str().trim()).unwrap(),
            );
            headers.insert(
                "Accept",
                reqwest::header::HeaderValue::from_static("application/json"),
            );
            headers
        };

        let response = self
            .client
            .get(full_url)
            .timeout(Duration::from_secs(60))
            .headers(headers)
            .send();

        convert_response_into_vector(response, asset_id_vec)
    }
}

fn convert_response_into_vector(
    response: Result<reqwest::blocking::Response, reqwest::Error>,
    asset_id_vec: Vec<(String, u32)>,
) -> Vec<(FeedResult, u32, Timestamp)> {
    let mut results_vec: Vec<(FeedResult, u32, Timestamp)> = Vec::new();

    // Helps handle errors in a similar way.
    fn handle_error(
        log_message: String,
        asset_id_vec: Vec<(String, u32)>,
    ) -> Vec<(FeedResult, u32, Timestamp)> {
        error!("{log_message}");

        asset_id_vec
            .iter()
            .map(|(_, id)| {
                (
                    Err(get_generic_feed_error("YahooFinance")),
                    *id,
                    current_unix_time(),
                )
            })
            .collect()
    }

    let response = match response {
        Err(err) => {
            let log_message = format!("Request failed with error: {}", err);
            return handle_error(log_message, asset_id_vec);
        }
        Ok(response) => response,
    };

    if !response.status().is_success() {
        let log_message = format!("Request failed with status: {}", response.status());
        return handle_error(log_message, asset_id_vec);
    }

    let resp_json = match response.json::<Value>() {
        Err(err) => {
            let log_message = format!("Request failed due to parse failure: {}", err);
            return handle_error(log_message, asset_id_vec);
        }
        Ok(resp_json) => resp_json,
    };

    let symbol_price_map: HashMap<String, f64> = resp_json["quoteResponse"]["result"]
        .as_array()
        .unwrap_or(&vec![]) // Provide an empty vec if result is not an array
        .iter()
        .filter_map(|result| {
            let symbol = result["symbol"].as_str();
            let price = result["regularMarketPrice"].as_f64();
            match (symbol, price) {
                (Some(symbol), Some(price)) => Some((symbol.to_string(), price)),
                _ => None, // TODO(snikolov): How to react to invalid entries?
            }
        })
        .collect();

    for (asset, feed_id) in asset_id_vec.iter() {
        trace!("Feed Asset pair: {} ... Feed Id: {}", asset, feed_id);
        results_vec.push((
            get_feed_result_from_hashmap(asset, &symbol_price_map),
            *feed_id,
            current_unix_time(),
        ));
    }

    results_vec
}

#[cfg(test)]
mod tests {
    use crate::services::yahoo_finance::convert_response_into_vector;
    use feed_registry::types::{FeedError, FeedResult, Timestamp};
    use reqwest::blocking;

    /// Helper function that makes tests more readable.
    fn extract_values_only(result: Vec<(FeedResult, u32, Timestamp)>) -> Vec<FeedResult> {
        result
            .into_iter()
            .map(|(value, _, _)| value)
            .collect::<Vec<FeedResult>>()
    }

    #[test]
    fn convert_response_into_vector_succeeds_on_empty_map_response() {
        // setup phase
        let http_response = http::response::Builder::new()
            .status(200)
            .body("{}")
            .unwrap();
        let response = blocking::Response::from(http_response);

        // test phase
        let result = convert_response_into_vector(Ok(response), vec![]);

        // check phase
        assert_eq!(result, vec![]);
    }

    #[test]
    fn convert_response_into_vector_succeeds_on_failed_response() {
        // setup phase
        let http_response = http::response::Builder::new()
            .status(404)
            .body("foo")
            .unwrap();
        let response = blocking::Response::from(http_response);

        // test phase
        let result = convert_response_into_vector(Ok(response), vec![]);

        // check phase
        assert_eq!(result, vec![]);
    }

    #[test]
    fn convert_response_into_vector_returns_vec_of_errors_on_failed_response() {
        // setup phase
        let http_response = http::response::Builder::new()
            .status(404)
            .body("foo")
            .unwrap();
        let response = blocking::Response::from(http_response);
        let assets = vec![
            ("FOO".to_owned(), 1),
            ("BAR".to_owned(), 2),
            ("BAZ".to_owned(), 3),
        ];

        // test phase
        let result = convert_response_into_vector(Ok(response), assets);

        // check phase
        let result_values = extract_values_only(result);
        let expected_values = vec![
            Err(FeedError::APIError("YahooFinance poll failed!".to_string())),
            Err(FeedError::APIError("YahooFinance poll failed!".to_string())),
            Err(FeedError::APIError("YahooFinance poll failed!".to_string())),
        ];
        assert_eq!(result_values, expected_values);
    }

    #[test]
    fn convert_response_into_vector_returns_err_on_single_colon() {
        // setup phase
        let http_response = http::response::Builder::new()
            .status(200)
            .body(":")
            .unwrap();
        let response = blocking::Response::from(http_response);
        let assets = vec![("FOO".to_owned(), 1)];

        // test phase
        let result = convert_response_into_vector(Ok(response), assets);

        // check phase
        let result_values = extract_values_only(result);
        let expected_values = vec![Err(FeedError::APIError(
            "YahooFinance poll failed!".to_string(),
        ))];
        assert_eq!(result_values, expected_values);
    }
}
