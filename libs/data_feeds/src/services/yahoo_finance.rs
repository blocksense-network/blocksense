use std::cell::RefCell;
use std::rc::Rc;

use async_trait::async_trait;
use ringbuf::traits::RingBuffer;
use ringbuf::HeapRb;
use serde::Serialize;
use yahoo_finance_api::YahooConnector;

use crate::connector::data_feed::Payload;
use crate::utils::{current_unix_time, get_env_var};
use crate::{
    connector::data_feed::DataFeed,
    types::{ConsensusMetric, DataFeedAPI},
};

#[derive(Serialize)]
pub struct YfPayload {
    result: f64,
}

impl Payload for YfPayload {}

#[async_trait(?Send)]
impl DataFeed for YahooDataFeed {
    fn api(&self) -> &DataFeedAPI {
        &DataFeedAPI::YahooFinance
    }

    fn api_connect(&self) -> Box<dyn DataFeed> {
        Box::new(YahooDataFeed::new())
    }

    fn is_connected(&self) -> bool {
        self.is_connected
    }

    fn score_by(&self) -> ConsensusMetric {
        ConsensusMetric::Mean
    }

    async fn poll(
        &mut self,
        ticker: &str,
    ) -> Result<(Rc<RefCell<dyn Payload>>, u64), anyhow::Error> {
        let response = self
            .api_connector
            .get_latest_quotes(ticker, "1d")
            .await?
            .last_quote()
            .unwrap();

        let payload: Rc<RefCell<dyn Payload>> = Rc::new(RefCell::new(YfPayload {
            result: response.close,
        }));

        Ok((payload, current_unix_time()))
    }

    fn collect_history(
        &mut self,
        response: Rc<RefCell<dyn Payload>>,
        timestamp: u64,
    ) -> Option<(Rc<RefCell<dyn Payload>>, u64)> {
        self.history_buffer.push_overwrite((response, timestamp))
    }
}

pub struct YahooDataFeed {
    api_connector: YahooConnector,
    is_connected: bool,
    history_buffer: HeapRb<(Rc<RefCell<dyn Payload>>, u64)>,
}

impl YahooDataFeed {
    pub fn new() -> Self {
        Self {
            api_connector: YahooConnector::new(),
            is_connected: true,
            history_buffer: HeapRb::<(Rc<RefCell<dyn Payload>>, u64)>::new(
                get_env_var("HISTORY_BUFFER_SIZE").unwrap_or(10_000),
            ),
        }
    }
}
