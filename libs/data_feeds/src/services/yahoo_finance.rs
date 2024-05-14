use async_trait::async_trait;
use serde::Serialize;
use yahoo_finance_api::YahooConnector;

use crate::connector::data_feed::Payload;
use crate::utils::current_unix_time;
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

    async fn poll(&self, ticker: &str) -> Result<(Box<dyn Payload>, u64), anyhow::Error> {
        let response = self
            .api_connector
            .get_latest_quotes(ticker, "1d")
            .await?
            .last_quote()
            .unwrap();

        let payload: Box<dyn Payload> = Box::new(YfPayload {
            result: response.close,
        });

        Ok((payload, current_unix_time()))
    }

    fn collect_history(&mut self, response: Box<dyn Payload>, timestamp: u64) {
        self.history_buffer.push((response, timestamp))
    }
}

pub struct YahooDataFeed {
    api_connector: YahooConnector,
    is_connected: bool,
    history_buffer: Vec<(Box<dyn Payload>, u64)>,
}

impl YahooDataFeed {
    pub fn new() -> Self {
        Self {
            api_connector: YahooConnector::new(),
            is_connected: true,
            history_buffer: Vec::new(),
        }
    }
}
