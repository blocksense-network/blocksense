use anyhow::{anyhow, Result};
use async_trait::async_trait;
use reqwest::blocking::Client;
use ringbuf::storage::Heap;
use ringbuf::traits::RingBuffer;
use ringbuf::{HeapRb, SharedRb};
use serde_json::Value;
use tracing::{debug, error, trace, warn};
use utils::read_file;
use utils::{get_env_var, time::current_unix_time};

extern crate derive;
use derive::{ApiConnect, Historical};

use crate::interfaces::{api_connect::ApiConnect, data_feed::DataFeed, historical::Historical};
use crate::services::common::get_generic_feed_error;
use feed_registry::{
    aggregate::{AverageAggregator, ConsensusMetric},
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

    if symbol == asset {
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
        Ok(price) => FeedResult::Result {
            result: FeedType::Numerical(price),
        },
        Err(e) => {
            error!(
                "{}",
                format!("Error occured while getting {} price! - {}", asset, e)
            );

            get_generic_feed_error("YahooFinance")
        }
    }
}

#[async_trait]
impl DataFeed for YahooFinanceDataFeed {
    fn score_by(&self) -> ConsensusMetric {
        ConsensusMetric::Mean(AverageAggregator {})
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

        let response = self.client.get(full_url).headers(headers).send().unwrap();

        if response.status().is_success() {
            let resp_json: Value = response.json().unwrap();

            (get_feed_result(&resp_json, 0, asset), current_unix_time())
        } else {
            warn!("Request failed with status: {}", response.status());

            (get_generic_feed_error("YahooFinance"), current_unix_time())
        }
    }

    async fn poll_batch(
        &mut self,
        asset_id_vec: &[(String, u32)],
    ) -> Vec<(FeedResult, u32, Timestamp)> {
        let url = "https://yfapi.net/v6/finance/quote";

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

        let response = self.client.get(full_url).headers(headers).send().unwrap();

        let mut results_vec: Vec<(FeedResult, u32, Timestamp)> = Vec::new();

        if response.status().is_success() {
            let resp_json: Value = response.json().unwrap(); //TODO(snikolov): Idiomatic way to handle

            for (idx, (asset, feed_id)) in asset_id_vec.iter().enumerate() {
                trace!("Feed Asset pair - {}.{}", asset, feed_id);
                results_vec.push((
                    get_feed_result(&resp_json, idx, asset),
                    *feed_id,
                    current_unix_time(),
                ));
            }

            results_vec
        } else {
            warn!("Request failed with status: {}", response.status());

            asset_id_vec
                .iter()
                .map(|(_, id)| {
                    (
                        get_generic_feed_error("YahooFinance"),
                        *id,
                        current_unix_time(),
                    )
                })
                .collect()
        }
    }
}
