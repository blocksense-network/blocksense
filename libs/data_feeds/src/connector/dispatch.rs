use feed_registry::{api::DataFeedAPI, registry::AllFeedsConfig};
use prometheus::metrics::DATA_FEED_PARSE_TIME_GAUGE;
use rand::{seq::IteratorRandom, thread_rng};
use sequencer_config::{FeedConfig, ReporterConfig};
use std::sync::Arc;
use std::{collections::HashMap, time::Instant};
use tokio::sync::Mutex;
use tracing::debug;
use utils::read_file;

use crate::{
    interfaces::data_feed::DataFeed,
    services::{coinmarketcap::CoinMarketCapDataFeed, yahoo_finance::YahooFinanceDataFeed},
};

use super::post::post_feed_response;

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
    connection_cache: &mut HashMap<DataFeedAPI, Arc<Mutex<dyn DataFeed>>>,
) -> Arc<Mutex<dyn DataFeed>> {
    handle_connection_cache(feed_api, resources, connection_cache)
}

fn handle_connection_cache(
    api: &DataFeedAPI,
    resources: &HashMap<String, String>,
    connection_cache: &mut HashMap<DataFeedAPI, Arc<Mutex<dyn DataFeed>>>,
) -> Arc<Mutex<dyn DataFeed>> {
    if !connection_cache.contains_key(api) {
        let feed: Arc<Mutex<dyn DataFeed>> = feed_builder(api, resources);
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
) -> Arc<Mutex<dyn DataFeed>> {
    match api {
        DataFeedAPI::EmptyAPI => todo!(),
        DataFeedAPI::YahooFinanceDataFeed => Arc::new(Mutex::new(YahooFinanceDataFeed::new())),
        DataFeedAPI::CoinMarketCapDataFeed => {
            let cmc_api_key_path = resources
                .get("CMC_API_KEY_PATH")
                .expect("CMC_API_KEY_PATH not provided in config!");

            Arc::new(Mutex::new(CoinMarketCapDataFeed::new(cmc_api_key_path.clone())))
        }
    }
}

pub async fn dispatch(
    reporter_config: &ReporterConfig,
    feed_registry: &AllFeedsConfig,
    connection_cache: &mut HashMap<DataFeedAPI, Arc<Mutex<dyn DataFeed>>>,
) {
    let feeds_subset = feed_selector(&feed_registry.feeds, reporter_config.batch_size);

    let secret_key_path = reporter_config
        .resources
        .get("SECRET_KEY_PATH")
        .expect("SECRET_KEY_PATH not set in config!");

    let secret_key = read_file(secret_key_path.as_str()).trim().to_string();

    for feed in feeds_subset {
        let start_time = Instant::now();

        let data_feed = resolve_feed(
            &DataFeedAPI::get_from_str(feed.script.as_str()),
            &reporter_config.resources,
            connection_cache,
        );

        // TODO(adikov):
        // * Parallelize data_feed.poll and post_feed_resopnse to be in different
        // threads and communicate via a channel.
        // * Handle post_feed_response Result propertly.
        let (result, timestamp_ms) = data_feed.lock().await.poll(&feed.name);
        let _ = post_feed_response(
            &reporter_config.reporter,
            &secret_key,
            feed.id,
            timestamp_ms,
            result,
            &reporter_config.sequencer_url,
        )
        .await;

        let elapsed_time_ms = start_time.elapsed().as_millis();
        DATA_FEED_PARSE_TIME_GAUGE
            .with_label_values(&[&feed.id.to_string()])
            .set(elapsed_time_ms as i64);
    }
}
