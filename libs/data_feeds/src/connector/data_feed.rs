use crate::{
    connector::post::post_api_response,
    services::{coinmarketcap::CoinMarketCapDataFeed, yahoo_finance::YahooDataFeed},
    types::{ConsensusMetric, DataFeedAPI},
};
use async_trait::async_trait;
use rand::{seq::IteratorRandom, thread_rng};
use std::{collections::HashMap, rc::Rc};

use erased_serde::serialize_trait_object;

serialize_trait_object!(Payload);

pub trait Payload: erased_serde::Serialize {}

#[async_trait(?Send)]
pub trait DataFeed {
    fn api_connect(&self) -> Box<dyn DataFeed>;

    fn is_connected(&self) -> bool;

    fn api(&self) -> &DataFeedAPI;

    fn score_by(&self) -> ConsensusMetric;

    async fn poll(&self, asset: &str) -> Result<(Box<dyn Payload>, u64), anyhow::Error>;

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
    feed_api: DataFeedAPI,
    connection_cache: &'a mut HashMap<DataFeedAPI, Rc<dyn DataFeed>>,
) -> Rc<dyn DataFeed> {
    handle_connection_cache(&feed_api, connection_cache)
}

fn handle_connection_cache<'a>(
    api: &DataFeedAPI,
    connection_cache: &'a mut HashMap<DataFeedAPI, Rc<dyn DataFeed>>,
) -> Rc<dyn DataFeed> {
    if !connection_cache.contains_key(&api) {
        let feed = feed_builder(&api);
        connection_cache.insert(api.to_owned(), feed);
    }

    connection_cache.get(&api).unwrap().clone()
}

fn feed_builder(api: &DataFeedAPI) -> Rc<dyn DataFeed> {
    match api {
        DataFeedAPI::EmptyAPI => todo!(),
        DataFeedAPI::YahooFinance => Rc::new(YahooDataFeed::new()),
        DataFeedAPI::CoinMarketCap => Rc::new(CoinMarketCapDataFeed::new()),
    }
}

pub async fn dispatch(
    sequencer_url: &str,
    batch_size: usize,
    feeds: &Vec<(DataFeedAPI, String)>,
    connection_cache: &mut HashMap<DataFeedAPI, Rc<dyn DataFeed>>,
) -> () {
    let feed_subset = feed_selector(feeds, batch_size);

    for (api, asset) in feed_subset {
        let data_feed = resolve_feed(api, connection_cache);
        post_api_response(sequencer_url, data_feed, &asset).await;
    }
}
