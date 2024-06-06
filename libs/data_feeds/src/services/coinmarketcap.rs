use async_trait::async_trait;
use cmc::{errors::CmcErrors, Cmc};
use ringbuf::{self, traits::RingBuffer, HeapRb};
use serde::Serialize;

use crate::{
    connector::{
        bytes::f64_to_bytes32,
        data_feed::{DataFeed, Payload},
        error::{ConversionError, FeedError},
    },
    types::{Bytes32, ConsensusMetric, DataFeedAPI, Timestamp},
    utils::{current_unix_time, get_env_var},
};

#[derive(Serialize, Clone, Copy)]
pub struct CMCPayload {
    result: f64,
}

impl Payload for CMCPayload {
    fn to_bytes32(&self) -> Result<Bytes32, ConversionError> {
        f64_to_bytes32(self.result)
    }
}

pub struct CoinMarketCapDataFeed {
    api_connector: Cmc,
    is_connected: bool,
    history_buffer: HeapRb<(Box<dyn Payload>, Timestamp)>,
}

impl CoinMarketCapDataFeed {
    pub fn new() -> Self {
        let cmc_api_key: String = get_env_var("CMC_API_KEY").unwrap();

        Self {
            api_connector: Cmc::new(cmc_api_key),
            is_connected: true,
            history_buffer: HeapRb::<(Box<dyn Payload>, Timestamp)>::new(
                get_env_var("HISTORY_BUFFER_SIZE").unwrap_or(10_000),
            ),
        }
    }
}

#[async_trait(?Send)]
impl DataFeed for CoinMarketCapDataFeed {
    fn api(&self) -> &DataFeedAPI {
        &DataFeedAPI::CoinMarketCap
    }

    fn api_connect(&self) -> Box<dyn DataFeed> {
        Box::new(CoinMarketCapDataFeed::new())
    }

    fn is_connected(&self) -> bool {
        self.is_connected
    }

    fn score_by(&self) -> ConsensusMetric {
        ConsensusMetric::Mean
    }

    async fn poll(&mut self, asset: &str) -> (Result<Box<dyn Payload>, FeedError>, Timestamp) {
        let response = self.api_connector.price(asset);

        match response {
            Ok(response) => (
                Ok(Box::new(CMCPayload { result: response })),
                current_unix_time(),
            ),
            Err(err) => (Err(FeedError::from(err)), current_unix_time()),
        }
    }

    fn collect_history(&mut self, response: Box<dyn Payload>, timestamp: u64) {
        self.history_buffer.push_overwrite((response, timestamp));
    }
}

impl From<CmcErrors> for FeedError {
    fn from(error: CmcErrors) -> Self {
        match error {
            // CmcErrors::RequestError(reqwest_error) => FeedError::RequestError(reqwest_error),
            CmcErrors::ApiError(api_error) => FeedError::APIError(api_error),
            _ => FeedError::UndefinedError,
        }
    }
}
