use ringbuf::storage::Heap;
use ringbuf::traits::RingBuffer;
use ringbuf::{HeapRb, SharedRb};
use tracing::{trace, warn};
use utils::{current_unix_time, get_env_var};
use yahoo_finance_api::YahooConnector;

extern crate derive;
use derive::{ApiConnect, Historical};

use crate::interfaces::{api_connect::ApiConnect, data_feed::DataFeed, historical::Historical};
use feed_registry::{
    aggregate::{AverageAggregator, ConsensusMetric},
    api::DataFeedAPI,
    types::{FeedError, FeedResult, FeedType, Timestamp},
};

impl DataFeed for YahooFinanceDataFeed {
    fn score_by(&self) -> ConsensusMetric {
        ConsensusMetric::Mean(AverageAggregator {})
    }

    fn poll(&mut self, ticker: &str) -> (FeedResult, Timestamp) {
        let response = self.api_connector.get_latest_quotes(ticker, "1d");

        trace!("response = {:?}", response);

        match response {
            Ok(response) => {
                let response_result = response.last_quote();
                match response_result {
                    Ok(res) => (
                        FeedResult::Result {
                            result: FeedType::Numerical(res.close),
                        },
                        current_unix_time(),
                    ),
                    Err(e) => {
                        warn!("YahooFinance API failed: {}", e);
                        (
                            FeedResult::Error {
                                error: FeedError::APIError(
                                    "CoinMarketCap poll failed!".to_string(),
                                ),
                            },
                            current_unix_time(),
                        )
                    }
                }
            }
            Err(_) => (
                FeedResult::Error {
                    error: FeedError::APIError("CoinMarketCap poll failed!".to_string()),
                },
                current_unix_time(),
            ),
        }
    }
}

// impl From<YahooError> for FeedError {
//     fn from(error: YahooError) -> Self {
//         match error {
//             // YahooError::ConnectionFailed(err) => FeedError::RequestError(err),
//             YahooError::FetchFailed(message) => FeedError::APIError(message),
//             _ => FeedError::UndefinedError,
//         }
//     }
// }

#[derive(ApiConnect, Historical)]
pub struct YahooFinanceDataFeed {
    api_connector: YahooConnector,
    is_connected: bool,
    history_buffer: HeapRb<(FeedType, Timestamp)>,
}

impl Default for YahooFinanceDataFeed {
    fn default() -> Self {
        Self::new()
    }
}

impl YahooFinanceDataFeed {
    pub fn new() -> Self {
        Self {
            api_connector: YahooConnector::new(),
            is_connected: true,
            history_buffer: HeapRb::<(FeedType, Timestamp)>::new(
                get_env_var("HISTORY_BUFFER_SIZE").unwrap_or(10_000),
            ),
        }
    }
}
