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
use sequencer_config::{get_config_file_path, ReporterConfig};
use utils::read_file;

use tracing::{debug, info};

use crate::{connector::dispatch::dispatch, interfaces::data_feed::DataFeed};
use feed_registry::{api::DataFeedAPI, registry::init_feeds_config};

pub fn init_reporter_config() -> ReporterConfig {
    let config_file_path = get_config_file_path("REPORTER_CONFIG_DIR", "/reporter_config.json");

    let data = read_file(config_file_path.as_str());

    info!("Using config file: {}", config_file_path.as_str());

    let reporter_config: ReporterConfig =
        serde_json::from_str(data.as_str()).expect("Config file is not valid JSON!");

    reporter_config
}

pub async fn orchestrator() {
    // Initializes a tracing subscriber that displays runtime information based on the RUST_LOG env variable
    tracing_subscriber::fmt::init();

    let reporter_config = init_reporter_config();

    let feeds_registry = init_feeds_config().expect("Failed to get config: ");

    let mut connection_cache = HashMap::<DataFeedAPI, Rc<RefCell<dyn DataFeed>>>::new();

    let encoder = TextEncoder::new();

    FEED_COUNTER.inc_by(feeds_registry.feeds.len() as u64);
    info!("Available feed count: {}\n", FEED_COUNTER.get());

    let request_client = reqwest::Client::new();

    loop {
        BATCH_COUNTER.inc();

        let start_time = Instant::now();

        dispatch(&reporter_config, &feeds_registry, &mut connection_cache);

        info!("Finished with {}-th batch..\n", BATCH_COUNTER.get());

        let elapsed_time_ms = start_time.elapsed().as_millis();

        //TODO(snikolov): `poll_period_ms` is dependent on the feed, we should ship payload ASAP and sleep this feed only.
        if elapsed_time_ms < reporter_config.poll_period_ms.into() {
            let remaining_time_ms = reporter_config.poll_period_ms - (elapsed_time_ms as u64);
            sleep(Duration::from_millis(remaining_time_ms));
        }

        UPTIME_COUNTER.inc_by((reporter_config.poll_period_ms as f64) / 1000.0);
        BATCH_PARSE_TIME_GAUGE.set(elapsed_time_ms as i64);

        let metrics_result = handle_prometheus_metrics(
            &request_client,
            reporter_config.prometheus_url.as_str(),
            &encoder,
        )
        .await;
        if let Err(e) = metrics_result {
            debug!("Error handling Prometheus metrics: {:?}", e);
        }
    }
}
