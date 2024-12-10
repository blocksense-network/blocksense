use std::time::Duration;

use async_trait::async_trait;
use feed_registry::{
    aggregate::FeedAggregate,
    api::DataFeedAPI,
    types::{Asset, FeedResult, FeedType, Timestamp},
};
use log::error;
use reqwest::blocking::Client;
use ringbuf::{self, storage::Heap, traits::RingBuffer, HeapRb, SharedRb};
use serde_json::Value;
use tracing::{debug, trace};
use utils::{get_env_var, read_file, time::current_unix_time};

use derive::{ApiConnect, Historical};

use crate::{
    interfaces::{api_connect::ApiConnect, data_feed::DataFeed, historical::Historical},
    services::common::get_generic_feed_error,
};

#[derive(ApiConnect, Historical)]
pub struct CoinMarketCapDataFeed {
    client: Client,
    api_key: String,
    is_connected: bool,
    history_buffer: HeapRb<(FeedType, Timestamp)>,
}

impl CoinMarketCapDataFeed {
    pub fn new(resource_path: String) -> Self {
        Self {
            client: Client::new(),
            is_connected: true,
            api_key: read_file(resource_path.as_str()),
            history_buffer: HeapRb::<(FeedType, Timestamp)>::new(
                get_env_var("HISTORY_BUFFER_SIZE").unwrap_or(10_000),
            ),
        }
    }
}

fn get_cmc_json_price(cmc_response: Value, asset: &str) -> Option<f64> {
    let price = cmc_response
        .get("data")
        .and_then(|data| data.get(asset))
        .and_then(|first_asset| first_asset.get("quote"))
        .and_then(|quote| quote.get("USD"))
        .and_then(|usd| usd.get("price"))
        .and_then(|price| price.as_f64());

    debug!("cmc_result = {:?}", price);

    price
}

fn get_feed_result(response_json: &Value, asset: &str) -> FeedResult {
    let price = get_cmc_json_price(response_json.clone(), asset);

    match price {
        Some(price) => Ok(FeedType::Numerical(price)),
        None => {
            error!("Could not parse CMC Response Json!");
            Err(get_generic_feed_error("CoinMarketCap"))
        }
    }
}

#[async_trait]
impl DataFeed for CoinMarketCapDataFeed {
    fn score_by(&self) -> FeedAggregate {
        FeedAggregate::AverageAggregator
    }

    fn poll(&mut self, asset: &str) -> (FeedResult, Timestamp) {
        let url = "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest";

        let params = [("id", asset)];

        let headers = {
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                "X-CMC_PRO_API_KEY",
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
            .get(url)
            .timeout(Duration::from_secs(60))
            .headers(headers)
            .query(&params)
            .send();

        if let Ok(response) = response {
            if response.status().is_success() {
                let resp_json: Value = response.json().unwrap();

                (get_feed_result(&resp_json, asset), current_unix_time())
            } else {
                error!("Request failed with status: {}", response.status());

                (
                    Err(get_generic_feed_error("CoinMarketCap")),
                    current_unix_time(),
                )
            }
        } else {
            //TODO(snikolov): Figure out how to handle the Error if it occurs
            error!("Request failed with error");

            (
                Err(get_generic_feed_error("CoinMarketCap")),
                current_unix_time(),
            )
        }
    }

    async fn poll_batch(&mut self, asset_id_vec: &[Asset]) -> Vec<(FeedResult, u32, Timestamp)> {
        let url = "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest";

        let asset_id_vec: Vec<(String, u32)> = asset_id_vec
            .iter()
            .map(|asset| {
                (
                    asset
                        .resources
                        .get("cmc_id")
                        .unwrap_or_else(|| {
                            panic!("[CMC] Missing resource `cmc_id` for feed - {:?}!", asset)
                        })
                        .clone(),
                    asset.feed_id,
                )
            })
            .collect();

        let assets: Vec<String> = asset_id_vec.iter().map(|(s, _)| s.clone()).collect();

        let params = [("id", assets.join(","))];

        debug!("{:?}", params);

        let headers = {
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                "X-CMC_PRO_API_KEY",
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
            .get(url)
            .timeout(Duration::from_secs(60))
            .headers(headers)
            .query(&params)
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
                    Err(get_generic_feed_error("CoinMarketCap")),
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

    for (asset, feed_id) in asset_id_vec {
        trace!("Feed Asset pair - {}.{}", asset, feed_id);
        results_vec.push((
            get_feed_result(&resp_json, asset.as_str()),
            feed_id,
            current_unix_time(),
        ));
    }

    results_vec
}

#[cfg(test)]
mod tests {
    use crate::services::coinmarketcap::convert_response_into_vector;
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
            Err(FeedError::APIError(
                "CoinMarketCap poll failed!".to_string(),
            )),
            Err(FeedError::APIError(
                "CoinMarketCap poll failed!".to_string(),
            )),
            Err(FeedError::APIError(
                "CoinMarketCap poll failed!".to_string(),
            )),
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
            "CoinMarketCap poll failed!".to_string(),
        ))];
        assert_eq!(result_values, expected_values);
    }
}
