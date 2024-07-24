use async_trait::async_trait;
use cmc::Cmc;
use feed_registry::types::{DataFeedAPI, FeedError, FeedResult, FeedType, Timestamp};
use ringbuf::{self, storage::Heap, traits::RingBuffer, HeapRb, SharedRb};
use tracing::{trace, warn};
use utils::{current_unix_time, get_env_var, read_file};

use derive::{ApiConnect, Historical};

use crate::interfaces::{api_connect::ApiConnect, data_feed::DataFeed, historical::Historical};

use super::aggregate::{AverageAggregator, ConsensusMetric};

#[derive(ApiConnect, Historical)]
pub struct CoinMarketCapDataFeed {
    api_connector: Cmc,
    is_connected: bool,
    history_buffer: HeapRb<(FeedType, Timestamp)>,
}

impl CoinMarketCapDataFeed {
    pub fn new(resource_path: String) -> Self {
        let cmc_api_key: String = read_file(resource_path.as_str());

        Self {
            api_connector: Cmc::new(cmc_api_key),
            is_connected: true,
            history_buffer: HeapRb::<(FeedType, Timestamp)>::new(
                get_env_var("HISTORY_BUFFER_SIZE").unwrap_or(10_000),
            ),
        }
    }
}

#[async_trait(?Send)]
impl DataFeed for CoinMarketCapDataFeed {
    fn score_by(&self) -> ConsensusMetric {
        ConsensusMetric::Mean(AverageAggregator {})
    }

    async fn poll(&mut self, asset: &str) -> (FeedResult, Timestamp) {
        let response = self.api_connector.price(asset);

        trace!("response = {:?}", response);

        match response {
            Ok(response) => (
                FeedResult::Result {
                    result: FeedType::Numerical(response),
                },
                current_unix_time(),
            ),
            Err(e) => {
                warn!("CoinMarketCap API failed: {}", e);
                (
                    FeedResult::Error {
                        error: FeedError::APIError("CoinMarketCap poll failed!".to_string()),
                    },
                    current_unix_time(),
                )
            }
        }
    }
}
