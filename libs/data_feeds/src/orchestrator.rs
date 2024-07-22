use std::{
    cell::RefCell,
    collections::HashMap,
    rc::Rc,
    thread::sleep,
    time::{Duration, Instant},
};

use prometheus::{
    actix_server::handle_prometheus_metrics,
    metrics::{BATCH_COUNTER, BATCH_PARSE_TIME_GAUGE, FEED_COUNTER, UPTIME_COUNTER},
    TextEncoder,
};
use sequencer_config::{get_reporter_config_file_path, FeedMetaData, ReporterConfig};
use utils::read_file;

use tracing::{debug, info};

use crate::{connector::dispatch::dispatch, interfaces::data_feed::DataFeed, types::DataFeedAPI};

pub fn init_reporter_config() -> ReporterConfig {
    let config_file_path = get_reporter_config_file_path();

    let data = read_file(config_file_path.as_str());

    info!("Using config file: {}", config_file_path.as_str());

    let reporter_config: ReporterConfig =
        serde_json::from_str(data.as_str()).expect("Config file is not valid JSON!");

    reporter_config
}

fn find_feed_meta_data_by_name<'a>(
    feeds: &'a Vec<FeedMetaData>,
    feed_name: &String,
) -> Option<&'a FeedMetaData> {
    feeds.iter().find(|&feed| feed.name == *feed_name)
}

pub async fn orchestrator() {
    // Initializes a tracing subscriber that displays runtime information based on the RUST_LOG env variable
    tracing_subscriber::fmt::init();

    let reporter_config = init_reporter_config();

    let mut connection_cache = HashMap::<DataFeedAPI, Rc<RefCell<dyn DataFeed>>>::new();

    let encoder = TextEncoder::new();

    let all_feeds = DataFeedAPI::get_all_feeds();
    debug!("All feeds dump - {:?}", all_feeds);

    /// Initialize feed_id_map so we can resolve the id of each feed during dispatch
    let mut feed_id_map = HashMap::<String, &FeedMetaData>::new();
    for (api, asset) in &all_feeds {
        let feed_name = DataFeedAPI::feed_asset_str(&api, &asset);

        match find_feed_meta_data_by_name(&reporter_config.feeds, &feed_name) {
            Some(feed_meta_data) => {
                feed_id_map.insert(feed_name, feed_meta_data);
            }
            None => panic!("Feed with name {} not found!", feed_name),
        }
    }

    FEED_COUNTER.inc_by(all_feeds.len() as u64);
    info!("Available feed count: {}\n", FEED_COUNTER.get());

    let prometheus_server = reqwest::Client::new();

    loop {
        BATCH_COUNTER.inc();

        let start_time = Instant::now();

        dispatch(
            &reporter_config,
            &all_feeds,
            &feed_id_map,
            &mut connection_cache,
        )
        .await;

        info!("Finished with {}-th batch..\n", BATCH_COUNTER.get());

        let elapsed_time = start_time.elapsed().as_millis();

        //TODO(snikolov): `poll_period_ms` is dependent on the feed, we should ship payload ASAP and sleep this feed only.
        if elapsed_time < reporter_config.poll_period_ms.into() {
            let remaining_time_ms = reporter_config.poll_period_ms - (elapsed_time as u64);
            sleep(Duration::from_millis(remaining_time_ms));
        }

        UPTIME_COUNTER.inc_by((reporter_config.poll_period_ms as f64) / 1000.0);
        BATCH_PARSE_TIME_GAUGE.set(elapsed_time as i64);

        let metrics_result = handle_prometheus_metrics(
            &prometheus_server,
            reporter_config.prometheus_url.as_str(),
            &encoder,
        )
        .await;
        if let Err(e) = metrics_result {
            debug!("Error handling Prometheus metrics: {:?}", e);
        }
    }
}
