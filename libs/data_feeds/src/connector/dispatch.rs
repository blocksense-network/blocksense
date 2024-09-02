use feed_registry::{
    api::DataFeedAPI,
    registry::AllFeedsConfig,
    types::{FeedResult, Timestamp},
};

use prometheus::metrics::DATA_FEED_PARSE_TIME_GAUGE;
use rand::{seq::IteratorRandom, thread_rng};
use sequencer_config::{FeedConfig, ReporterConfig};
use std::sync::Arc;
use std::{collections::HashMap, time::Instant};
use strum::IntoEnumIterator;
use tokio::sync::{mpsc::UnboundedSender, Mutex};
use tracing::debug;

use crate::{
    interfaces::data_feed::DataFeed,
    services::{coinmarketcap::CoinMarketCapDataFeed, yahoo_finance::YahooFinanceDataFeed},
};

fn feed_selector(feeds: &[FeedConfig], batch_size: usize) -> Vec<FeedConfig> {
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
    connection_cache: &mut HashMap<DataFeedAPI, Arc<Mutex<dyn DataFeed + Send>>>,
) -> Arc<Mutex<dyn DataFeed + Send>> {
    handle_connection_cache(feed_api, resources, connection_cache)
}

fn handle_connection_cache(
    api: &DataFeedAPI,
    resources: &HashMap<String, String>,
    connection_cache: &mut HashMap<DataFeedAPI, Arc<Mutex<dyn DataFeed + Send>>>,
) -> Arc<Mutex<dyn DataFeed + Send>> {
    if !connection_cache.contains_key(api) {
        let feed: Arc<Mutex<dyn DataFeed + Send>> = feed_builder(api, resources);
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
) -> Arc<Mutex<dyn DataFeed + Send>> {
    match api {
        DataFeedAPI::EmptyAPI => todo!(),
        DataFeedAPI::YahooFinanceDataFeed => {
            let yh_finance_api_key_path = resources
                .get("YH_FINANCE_API_KEY_PATH")
                .expect("YH_FINANCE_API_KEY_PATH not provided in config!");

            Arc::new(Mutex::new(YahooFinanceDataFeed::new(
                yh_finance_api_key_path.clone(),
            )))
        }
        DataFeedAPI::CoinMarketCapDataFeed => {
            let cmc_api_key_path = resources
                .get("CMC_API_KEY_PATH")
                .expect("CMC_API_KEY_PATH not provided in config!");

            Arc::new(Mutex::new(CoinMarketCapDataFeed::new(
                cmc_api_key_path.clone(),
            )))
        }
    }
}
/// Compute a subset of `FeedConfig`
/// Initialize/Get API instances from connection_cache
/// Poll the given API with a various
pub async fn dispatch_subset(
    reporter_config: &ReporterConfig,
    feed_registry: &AllFeedsConfig,
    connection_cache: &mut HashMap<DataFeedAPI, Arc<Mutex<dyn DataFeed + Send>>>,
    data_feed_sender: UnboundedSender<(FeedResult, Timestamp, u32)>,
) {
    let feeds_subset = feed_selector(&feed_registry.feeds, reporter_config.batch_size);

    for feed in feeds_subset {
        let start_time = Instant::now();

        let data_feed = resolve_feed(
            &DataFeedAPI::get_from_str(feed.script.as_str()),
            &reporter_config.resources,
            connection_cache,
        );

        let feed_name = feed.name.clone();
        let feed_id = feed.id;
        let tx = data_feed_sender.clone();
        tokio::task::spawn(async move {
            let (result, timestamp_ms) = data_feed.lock().await.poll(&feed_name);
            tx.send((result, timestamp_ms, feed_id)).unwrap();
            debug!("DataFeed {:?} polled", feed_name);
        });

        let elapsed_time_ms = start_time.elapsed().as_millis();
        DATA_FEED_PARSE_TIME_GAUGE
            .with_label_values(&[&feed.id.to_string()])
            .set(elapsed_time_ms as i64);
    }
}

/// Take all API interfaces
/// Poll all available feeds per API interface
/// Collect Results and batch post all results.
pub async fn dispatch_full_batch(
    reporter_config: &ReporterConfig,
    feed_registry: &AllFeedsConfig,
    connection_cache: &mut HashMap<DataFeedAPI, Arc<Mutex<dyn DataFeed + Send>>>,
    data_feed_sender: UnboundedSender<(Vec<(FeedResult, u32, Timestamp)>, String)>,
) {
    let mut script_to_assets: HashMap<String, Vec<(String, u32)>> = HashMap::new();

    for feed in &feed_registry.feeds {
        script_to_assets
            .entry(feed.script.clone())
            .or_default()
            .push((feed.name.clone(), feed.id));
    }

    for feed_api_enum in DataFeedAPI::iter() {
        if let DataFeedAPI::EmptyAPI = feed_api_enum {
            // Skip this iteration if it's an EmptyAPI
            continue;
        }

        let tx = data_feed_sender.clone();

        let feed_api = resolve_feed(&feed_api_enum, &reporter_config.resources, connection_cache);
        let feed_api_name = feed_api_enum.get_as_str();

        let asset_id_vec = script_to_assets
            .get(feed_api_name)
            .expect("Unrecognized DataFeed Script!")
            .clone();

        tokio::task::spawn(async move {
            let results = feed_api.lock().await.poll_batch(&asset_id_vec);
            tx.send((results, feed_api_name.to_string())).unwrap();
            debug!("DataFeed {} polled", feed_api_enum.get_as_str());
        });
    }
}
