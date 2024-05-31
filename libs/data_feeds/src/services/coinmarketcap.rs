use std::{cell::RefCell, rc::Rc};

use async_trait::async_trait;
use cmc::Cmc;
use ringbuf::{self, traits::RingBuffer, HeapRb};
use serde::Serialize;

use crate::{
    connector::data_feed::{DataFeed, Payload},
    types::{ConsensusMetric, DataFeedAPI},
    utils::{current_unix_time, get_env_var},
};

#[derive(Serialize)]
pub struct CMCPayload {
    result: f64,
}

impl Payload for CMCPayload {}

pub struct CoinMarketCapDataFeed {
    api_connector: Cmc,
    is_connected: bool,
    history_buffer: HeapRb<(Rc<RefCell<dyn Payload>>, u64)>,
}

impl CoinMarketCapDataFeed {
    pub fn new() -> Self {
        let cmc_api_key: String = get_env_var("CMC_API_KEY").unwrap();

        Self {
            api_connector: Cmc::new(cmc_api_key),
            is_connected: true,
            history_buffer: HeapRb::<(Rc<RefCell<dyn Payload>>, u64)>::new(
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

    async fn poll(
        &mut self,
        asset: &str,
    ) -> Result<(Rc<RefCell<dyn Payload>>, u64), anyhow::Error> {
        let response = self.api_connector.price(asset);

        let response = match response {
            Ok(response) => response,
            Err(e) => {
                eprintln!("API failed with err - {}", e);
                -1.
            }
        };

        let payload = Rc::new(RefCell::new(CMCPayload { result: response }));

        let unix_ts = current_unix_time();

        self.collect_history(payload.clone(), unix_ts);
        Ok((payload, unix_ts))
    }

    fn collect_history(
        &mut self,
        response: Rc<RefCell<dyn Payload>>,
        timestamp: u64,
    ) -> Option<(Rc<RefCell<dyn Payload>>, u64)> {
        self.history_buffer.push_overwrite((response, timestamp))
    }
}
