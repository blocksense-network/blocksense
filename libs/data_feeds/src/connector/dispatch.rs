use std::{cell::RefCell, collections::HashMap, rc::Rc, time::Instant};

use prometheus::metrics::DATA_FEED_PARSE_TIME_GAUGE;
use rand::{seq::IteratorRandom, thread_rng};

use crate::{
    interfaces::data_feed::DataFeed,
    services::{coinmarketcap::CoinMarketCapDataFeed, yahoo_finance::YahooFinanceDataFeed},
    types::DataFeedAPI,
};

use super::post::post_feed_response;

fn feed_selector(feeds: &[(DataFeedAPI, String)], batch_size: usize) -> Vec<(DataFeedAPI, String)> {
    let mut rng = thread_rng();

    let selected_feeds_idx = (0..feeds.len()).choose_multiple(&mut rng, batch_size);
    let selected_feeds = selected_feeds_idx
        .iter()
        .map(|&idx| feeds[idx].clone())
        .collect();

    selected_feeds
}

fn resolve_feed(
    feed_api: &DataFeedAPI,
    connection_cache: &mut HashMap<DataFeedAPI, Rc<RefCell<dyn DataFeed>>>,
) -> Rc<RefCell<dyn DataFeed>> {
    handle_connection_cache(feed_api, connection_cache)
}

fn handle_connection_cache(
    api: &DataFeedAPI,
    connection_cache: &mut HashMap<DataFeedAPI, Rc<RefCell<dyn DataFeed>>>,
) -> Rc<RefCell<dyn DataFeed>> {
    if !connection_cache.contains_key(api) {
        let feed = feed_builder(api);
        connection_cache.insert(api.to_owned(), feed);
    }

    connection_cache.get(api).unwrap().clone()
}

fn feed_builder(api: &DataFeedAPI) -> Rc<RefCell<dyn DataFeed>> {
    match api {
        DataFeedAPI::EmptyAPI => todo!(),
        DataFeedAPI::YahooFinanceDataFeed => Rc::new(RefCell::new(YahooFinanceDataFeed::new())),
        DataFeedAPI::CoinMarketCapDataFeed => Rc::new(RefCell::new(CoinMarketCapDataFeed::new())),
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
