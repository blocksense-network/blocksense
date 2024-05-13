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

    fn api(&self) -> DataFeedAPI;

    fn score_by(&self) -> ConsensusMetric;

    async fn poll(&self, asset: &str) -> Result<(Box<dyn Payload>, u64), anyhow::Error>;

    fn collect_history(&mut self, response: Box<dyn Payload>, timestamp: u64);

    //TODO: Implement abstraction for publishing

    // async fn publish(destination: String, payload: Box<dyn Payload>) -> Result<(),anyhow::Error>;

    // fn host_connect(&self);
}

pub fn feed_selector<'a>(
    feeds: Vec<(DataFeedAPI, String)>,
    connection_cache: &'a mut HashMap<DataFeedAPI, Rc<dyn DataFeed>>,
    batch_size: usize,
) -> Vec<(Rc<dyn DataFeed>, String)> {
    let mut rng = thread_rng();
    let selected = (0..feeds.len()).choose_multiple(&mut rng, batch_size);

    let mut selected_feeds: Vec<(Rc<dyn DataFeed>, String)> = Vec::with_capacity(batch_size);

    for &i in &selected {
        let (api, asset) = &feeds[i];
        let feed = handle_connection_cache(api, connection_cache);
        selected_feeds.push((feed, asset.to_owned()));
    }

    selected_feeds
}

pub fn handle_connection_cache<'a>(
    api: &DataFeedAPI,
    connection_cache: &'a mut HashMap<DataFeedAPI, Rc<dyn DataFeed>>,
) -> Rc<dyn DataFeed> {
    if !connection_cache.contains_key(&api) {
        let feed = feed_builder(&api);
        connection_cache.insert(api.to_owned(), feed);
    }

    connection_cache.get(&api).unwrap().clone()
}

pub fn feed_builder(api: &DataFeedAPI) -> Rc<dyn DataFeed> {
    match api {
        DataFeedAPI::EmptyAPI => todo!(),
        DataFeedAPI::YahooFinance => Rc::new(YahooDataFeed::new()),
        DataFeedAPI::CoinMarketCap => Rc::new(CoinMarketCapDataFeed::new()),
    }
}

pub async fn dispatch(
    sequencer_url: &str,
    batch_size: usize,
    connection_cache: &mut HashMap<DataFeedAPI, Rc<dyn DataFeed>>,
) -> () {
    let all_feeds = DataFeedAPI::get_all_feeds();

    let feed_subset = feed_selector(all_feeds, connection_cache, batch_size);

    for (data_feed, asset) in feed_subset {
        post_api_response(sequencer_url, data_feed, &asset).await;
    }
}
