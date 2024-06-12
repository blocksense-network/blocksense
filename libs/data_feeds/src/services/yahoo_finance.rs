use async_trait::async_trait;
use ringbuf::storage::Heap;
use ringbuf::traits::RingBuffer;
use ringbuf::{HeapRb, SharedRb};
use serde::Serialize;
use utils::{current_unix_time, get_env_var};
use yahoo_finance_api::{YahooConnector, YahooError};

extern crate derive;
use derive::{ApiConnect, Historical};

use crate::connector::bytes::f64_to_bytes32;
use crate::connector::error::{ConversionError, FeedError};
use crate::interfaces::payload::Payload;
use crate::interfaces::{api_connect::ApiConnect, data_feed::DataFeed, historical::Historical};
use crate::types::{Bytes32, ConsensusMetric, DataFeedAPI, Timestamp};

#[derive(Serialize, Clone, Copy)]
pub struct YfPayload {
    result: f64,
}

impl Payload for YfPayload {
    fn to_bytes32(&self) -> Result<Bytes32, ConversionError> {
        f64_to_bytes32(self.result)
    }
}

#[async_trait(?Send)]
impl DataFeed for YahooDataFeed {
    fn score_by(&self) -> ConsensusMetric {
        ConsensusMetric::Mean
    }

    async fn poll(&mut self, ticker: &str) -> (Result<Box<dyn Payload>, FeedError>, Timestamp) {
        let response = self.api_connector.get_latest_quotes(ticker, "1d").await;

        match response {
            Ok(response) => (
                Ok(Box::new(YfPayload {
                    result: response.last_quote().unwrap().close,
                })),
                current_unix_time(),
            ),
            Err(err) => (Err(FeedError::from(err)), current_unix_time()),
        }
    }
}

impl From<YahooError> for FeedError {
    fn from(error: YahooError) -> Self {
        match error {
            // YahooError::ConnectionFailed(err) => FeedError::RequestError(err),
            YahooError::FetchFailed(message) => FeedError::APIError(message),
            _ => FeedError::UndefinedError,
        }
    }
}

#[derive(ApiConnect, Historical)]
pub struct YahooDataFeed {
    api_connector: YahooConnector,
    is_connected: bool,
    history_buffer: HeapRb<(Box<dyn Payload>, Timestamp)>,
}

impl YahooDataFeed {
    pub fn new() -> Self {
        Self {
            api_connector: YahooConnector::new(),
            is_connected: true,
            history_buffer: HeapRb::<(Box<dyn Payload>, Timestamp)>::new(
                get_env_var("HISTORY_BUFFER_SIZE").unwrap_or(10_000),
            ),
        }
    }
}
