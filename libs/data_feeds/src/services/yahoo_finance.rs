use async_trait::async_trait;
use ringbuf::storage::Heap;
use ringbuf::traits::RingBuffer;
use ringbuf::{ HeapRb, SharedRb };
use utils::{ current_unix_time, get_env_var };
use yahoo_finance_api::YahooConnector;

extern crate derive;
use derive::{ ApiConnect, Historical };

use crate::interfaces::{ api_connect::ApiConnect, data_feed::DataFeed, historical::Historical };
use crate::types::{ ConsensusMetric, DataFeedAPI, FeedError, FeedResult, FeedType, Timestamp };

use super::aggregate::AverageAggregator;

// #[derive(Serialize, Clone, Copy)]
// pub struct YfPayload {
//     result: f64,
// }

// impl Payload for YfPayload {
//     fn to_bytes32(&self) -> Result<Bytes32, ConversionError> {
//         f64_to_bytes32(self.result)
//     }
// }

#[async_trait(?Send)]
impl DataFeed for YahooFinanceDataFeed {
  fn score_by(&self) -> ConsensusMetric {
    ConsensusMetric::Mean(AverageAggregator {})
  }

  async fn poll(&mut self, ticker: &str) -> (FeedResult, Timestamp) {
    let response = self.api_connector.get_latest_quotes(ticker, "1d").await;

    match response {
      Ok(response) =>
        (
          FeedResult::Result { result: FeedType::Numerical(response.last_quote().unwrap().close) },
          current_unix_time(),
        ),
      Err(_) =>
        (
          FeedResult::Error {
            error: FeedError::from(FeedError::APIError("CoinMarketCap poll failed!".to_string())),
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

impl YahooFinanceDataFeed {
  pub fn new() -> Self {
    Self {
      api_connector: YahooConnector::new(),
      is_connected: true,
      history_buffer: HeapRb::<(FeedType, Timestamp)>::new(
        get_env_var("HISTORY_BUFFER_SIZE").unwrap_or(10_000)
      ),
    }
  }
}
