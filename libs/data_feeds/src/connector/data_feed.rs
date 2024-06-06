use crate::{
    services::{coinmarketcap::CoinMarketCapDataFeed, yahoo_finance::YahooDataFeed},
    types::{Bytes32, ConsensusMetric, DataFeedAPI, Timestamp},
};
use async_trait::async_trait;
use erased_serde::serialize_trait_object;
use prometheus::metrics::DATA_FEED_PARSE_TIME_GAUGE;
use rand::{seq::IteratorRandom, thread_rng};
use std::{cell::RefCell, collections::HashMap, rc::Rc, time::Instant};

use super::{
    error::{ConversionError, FeedError},
    post::post_feed_response,
};

serialize_trait_object!(Payload);

pub trait Payload: erased_serde::Serialize {
    fn to_bytes32(&self) -> Result<Bytes32, ConversionError>;
}

#[async_trait(?Send)]
pub trait DataFeed {
    fn api_connect(&self) -> Box<dyn DataFeed>;

    fn is_connected(&self) -> bool;

    fn api(&self) -> &DataFeedAPI;

    fn score_by(&self) -> ConsensusMetric;

    async fn poll(&mut self, asset: &str) -> (Result<Box<dyn Payload>, FeedError>, Timestamp);

    fn collect_history(&mut self, response: Box<dyn Payload>, timestamp: u64);

    //TODO: Implement abstraction for publishing

    // async fn publish(destination: String, payload: Box<dyn Payload>) -> Result<(),anyhow::Error>;

    // fn host_connect(&self);
}

fn feed_selector(
    feeds: &Vec<(DataFeedAPI, String)>,
    batch_size: usize,
) -> Vec<(DataFeedAPI, String)> {
    let mut rng = thread_rng();

    let selected_feeds_idx = (0..feeds.len()).choose_multiple(&mut rng, batch_size);
    let selected_feeds = selected_feeds_idx
        .iter()
        .map(|&idx| feeds[idx].clone())
        .collect();

    selected_feeds
}

fn resolve_feed<'a>(
    feed_api: &DataFeedAPI,
    connection_cache: &'a mut HashMap<DataFeedAPI, Rc<RefCell<dyn DataFeed>>>,
) -> Rc<RefCell<dyn DataFeed>> {
    handle_connection_cache(&feed_api, connection_cache)
}

fn handle_connection_cache<'a>(
    api: &DataFeedAPI,
    connection_cache: &'a mut HashMap<DataFeedAPI, Rc<RefCell<dyn DataFeed>>>,
) -> Rc<RefCell<dyn DataFeed>> {
    if !connection_cache.contains_key(&api) {
        let feed = feed_builder(&api);
        connection_cache.insert(api.to_owned(), feed);
    }

    connection_cache.get(&api).unwrap().clone()
}

fn feed_builder(api: &DataFeedAPI) -> Rc<RefCell<dyn DataFeed>> {
    match api {
        DataFeedAPI::EmptyAPI => todo!(),
        DataFeedAPI::YahooFinance => Rc::new(RefCell::new(YahooDataFeed::new())),
        DataFeedAPI::CoinMarketCap => Rc::new(RefCell::new(CoinMarketCapDataFeed::new())),
    }
}

pub async fn dispatch(
    reporter_id: u64,
    sequencer_url: &str,
    batch_size: usize,
    feeds: &Vec<(DataFeedAPI, String)>,
    connection_cache: &mut HashMap<DataFeedAPI, Rc<RefCell<dyn DataFeed>>>,
) {
    let feed_subset = feed_selector(feeds, batch_size);

    for (api, asset) in feed_subset {
        let start_time = Instant::now();

        let data_feed = resolve_feed(&api, connection_cache);
        let feed_asset_name = DataFeedAPI::feed_asset_str(&api, &asset);

        post_feed_response(
            reporter_id,
            sequencer_url,
            data_feed,
            &feed_asset_name,
            &asset,
        )
        .await;

        let elapsed_time = start_time.elapsed().as_millis();
        DATA_FEED_PARSE_TIME_GAUGE
            .with_label_values(&[feed_asset_name.as_str()])
            .set(elapsed_time as i64);
    }
}
