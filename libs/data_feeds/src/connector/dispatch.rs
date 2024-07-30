use std::{cell::RefCell, collections::HashMap, rc::Rc, time::Instant};

use prometheus::metrics::DATA_FEED_PARSE_TIME_GAUGE;
use rand::{seq::IteratorRandom, thread_rng};
use sequencer_config::{FeedMetaData, ReporterConfig};
use tracing::debug;
use utils::read_file;

use crate::{
    interfaces::data_feed::DataFeed,
    services::{coinmarketcap::CoinMarketCapDataFeed, yahoo_finance::YahooFinanceDataFeed},
    types::DataFeedAPI,
};

use super::post::post_feed_response;

fn feed_selector(feeds: &[(DataFeedAPI, String)], batch_size: usize) -> Vec<(DataFeedAPI, String)> {
    let mut rng = thread_rng();

    let selected_feeds_idx = (0..feeds.len()).choose_multiple(&mut rng, batch_size);
    debug!("Selected feeds indices {:?}", selected_feeds_idx);

    let selected_feeds = selected_feeds_idx
        .iter()
        .map(|&idx| feeds[idx].clone())
        .collect();
    debug!("Selected feeds {:?}", selected_feeds);

    selected_feeds
}

fn resolve_feed(
    feed_api: &DataFeedAPI,
    resources: &HashMap<String, String>,
    connection_cache: &mut HashMap<DataFeedAPI, Rc<RefCell<dyn DataFeed>>>,
) -> Rc<RefCell<dyn DataFeed>> {
    handle_connection_cache(feed_api, resources, connection_cache)
}

fn handle_connection_cache(
    api: &DataFeedAPI,
    resources: &HashMap<String, String>,
    connection_cache: &mut HashMap<DataFeedAPI, Rc<RefCell<dyn DataFeed>>>,
) -> Rc<RefCell<dyn DataFeed>> {
    if !connection_cache.contains_key(api) {
        let feed: Rc<RefCell<dyn DataFeed>> = feed_builder(api, resources);
        connection_cache.insert(api.to_owned(), feed);
    }

    connection_cache
        .get(api)
        .expect("Failed to get DataFeed from connection cache")
        .clone()
}

fn feed_builder(
    api: &DataFeedAPI,
    resources: &HashMap<String, String>,
) -> Rc<RefCell<dyn DataFeed>> {
    match api {
        DataFeedAPI::EmptyAPI => todo!(),
        DataFeedAPI::YahooFinanceDataFeed => Rc::new(RefCell::new(YahooFinanceDataFeed::new())),
        DataFeedAPI::CoinMarketCapDataFeed => {
            let cmc_api_key_path = resources
                .get("CMC_API_KEY_PATH")
                .expect("CMC_API_KEY_PATH not provided in config!");
            let cmc_api_key_path = std::env::var("BLOCKSENSE_ROOT")
                .expect("BLOCKSENSE_ROOT env not set")
                .to_string()
                + cmc_api_key_path;

            Rc::new(RefCell::new(CoinMarketCapDataFeed::new(cmc_api_key_path)))
        }
    }
}

pub async fn dispatch(
    reporter_config: &ReporterConfig,
    feeds: &Vec<(DataFeedAPI, String)>,
    feed_id_map: &HashMap<String, &FeedMetaData>,
    connection_cache: &mut HashMap<DataFeedAPI, Rc<RefCell<dyn DataFeed>>>,
) {
    let feed_subset = feed_selector(feeds, reporter_config.batch_size);

    let secret_key_path = std::env::var("BLOCKSENSE_ROOT")
        .expect("BLOCKSENSE_ROOT env not set")
        .to_string()
        + reporter_config.secret_key_path.as_str();
    println!("{}", secret_key_path);
    let secret_key = read_file(secret_key_path.as_str()).trim().to_string();

    for (api, asset) in feed_subset {
        let start_time = Instant::now();

        let data_feed = resolve_feed(&api, &reporter_config.resources, connection_cache);
        let feed_asset_name = DataFeedAPI::feed_asset_str(&api, &asset);
        let feed_id = feed_id_map
            .get(&feed_asset_name)
            .expect("`feed_id_map` encountered unknown key!")
            .id;

        post_feed_response(
            &reporter_config.reporter,
            &secret_key,
            data_feed,
            feed_id,
            &asset,
            &reporter_config.sequencer_url,
        )
        .await;

        let elapsed_time = start_time.elapsed().as_millis();
        DATA_FEED_PARSE_TIME_GAUGE
            .with_label_values(&[feed_asset_name.as_str()])
            .set(elapsed_time as i64);
    }
}
