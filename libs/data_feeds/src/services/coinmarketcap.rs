use feed_registry::{
    aggregate::{AverageAggregator, ConsensusMetric},
    api::DataFeedAPI,
    types::{FeedError, FeedResult, FeedType, Timestamp},
};
use log::error;
use reqwest::blocking::{Client, Response};
use ringbuf::{self, storage::Heap, traits::RingBuffer, HeapRb, SharedRb};
use serde_json::Value;
use tracing::{debug, trace, warn};
use utils::{get_env_var, read_file, time::current_unix_time};

use derive::{ApiConnect, Historical};

use crate::{
    interfaces::{api_connect::ApiConnect, data_feed::DataFeed, historical::Historical},
    services::common::{fill_generic_feed_error_vec, get_generic_feed_error},
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
        .and_then(|asset_arr| asset_arr.get(0))
        .and_then(|first_asset| first_asset.get("quote"))
        .and_then(|quote| quote.get("USD"))
        .and_then(|usd| usd.get("price"))
        .and_then(|price| price.as_f64());

    debug!("cmc_result = {:?}", price);

    price
}

fn get_feed_result(response_json: &Value, asset: &str) -> (FeedResult, Timestamp) {
    let price = get_cmc_json_price(response_json.clone(), asset);

    match price {
        Some(price) => (
            FeedResult::Result {
                result: FeedType::Numerical(price),
            },
            current_unix_time(),
        ),
        None => {
            error!("Could not parse CMC Response Json!");

            get_generic_feed_error("CoinMarketCap")
        }
    }
}

impl DataFeed for CoinMarketCapDataFeed {
    fn score_by(&self) -> ConsensusMetric {
        ConsensusMetric::Mean(AverageAggregator {})
    }

    fn poll(&mut self, asset: &str) -> (FeedResult, Timestamp) {
        let url = "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest";

        let params = [("symbol", asset)];

        let headers = {
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                "X-CMC_PRO_API_KEY",
                reqwest::header::HeaderValue::from_str(self.api_key.as_str()).unwrap(),
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
            .headers(headers)
            .query(&params)
            .send()
            .unwrap();

        if response.status().is_success() {
            let resp_json: Value = response.json().unwrap();

            get_feed_result(&resp_json, asset)
        } else {
            warn!("Request failed with status: {}", response.status());

            get_generic_feed_error("CoinMarketCap")
        }
    }

    fn poll_batch(&mut self, assets: &Vec<String>) -> Vec<(FeedResult, Timestamp)> {
        let url = "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest";

        let params = [("symbol", assets.join(","))];

        let headers = {
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                "X-CMC_PRO_API_KEY",
                reqwest::header::HeaderValue::from_str(self.api_key.as_str()).unwrap(),
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
            .headers(headers)
            .query(&params)
            .send()
            .unwrap();

        let mut results_vec: Vec<(FeedResult, Timestamp)> = Vec::new();

        if response.status().is_success() {
            let resp_json: Value = response.json().unwrap(); //TODO(snikolov): Idiomatic way to handle

            for asset in assets {
                results_vec.push(get_feed_result(&resp_json, asset));
            }

            results_vec
        } else {
            warn!("Request failed with status: {}", response.status());

            fill_generic_feed_error_vec("CoinMarketCap", assets.len())
        }
    }
}
