use std::{
    collections::HashMap,
    sync::Arc,
    thread::sleep,
    time::{Duration, Instant},
};

use config::{get_validated_config, init_config, AllFeedsConfig, ReporterConfig};
use prometheus::{
    actix_server::handle_prometheus_metrics,
    metrics::{BATCH_COUNTER, BATCH_PARSE_TIME_GAUGE, FEED_COUNTER, UPTIME_COUNTER},
    TextEncoder,
};
use tokio::sync::{mpsc, Mutex};
use utils::read_file;
use utils::{
    constants::{FEEDS_CONFIG_DIR, FEEDS_CONFIG_FILE, REPORTER_CONFIG_DIR, REPORTER_CONFIG_FILE},
    get_config_file_path,
};

use tracing::{debug, info};

use crate::{
    connector::{
        dispatch::{dispatch_full_batch, dispatch_subset},
        post::post_feed_response,
    },
    interfaces::data_feed::DataFeed,
};
use feed_registry::{
    api::DataFeedAPI,
    types::{FeedResult, Timestamp},
};

fn start_reporter_subset(
    reporter_config: &ReporterConfig,
    mut receiver: mpsc::UnboundedReceiver<(FeedResult, Timestamp, u32)>,
) {
    let secret_key_path = reporter_config
        .resources
        .get("SECRET_KEY_PATH")
        .expect("SECRET_KEY_PATH not set in config!");

    let secret_key = read_file(secret_key_path.as_str()).trim().to_string();
    let sequencer_url = reporter_config.sequencer_url.clone();
    let reporter = reporter_config.reporter.clone();

    tokio::task::spawn(async move {
        while let Some((result, timestamp_ms, feed_id)) = receiver.recv().await {
            let res = post_feed_response(
                &reporter,
                &secret_key,
                feed_id,
                timestamp_ms,
                result,
                &sequencer_url,
            )
            .await;
            debug!("Data feed response sent {:?}", res);
        }
    });
}

pub async fn orchestrator() {
    // Initializes a tracing subscriber that displays runtime information based on the RUST_LOG env variable
    tracing_subscriber::fmt::init();

    let config_file_path: std::path::PathBuf =
        get_config_file_path(REPORTER_CONFIG_DIR, REPORTER_CONFIG_FILE);
    let reporter_config =
        get_validated_config::<ReporterConfig>(&config_file_path, "ReporterConfig")
            .expect("Config file is not valid JSON!");

    let feeds_config_file = get_config_file_path(FEEDS_CONFIG_DIR, FEEDS_CONFIG_FILE);
    let feeds_registry =
        init_config::<AllFeedsConfig>(&feeds_config_file).expect("Failed to get config: ");

    let mut connection_cache = HashMap::<DataFeedAPI, Arc<Mutex<dyn DataFeed + Send>>>::new();

    let encoder = TextEncoder::new();

    FEED_COUNTER.inc_by(feeds_registry.feeds.len() as u64);
    info!("Available feed count: {}\n", FEED_COUNTER.get());

    let request_client = reqwest::Client::new();

    let (tx_batch, rx_batch) = mpsc::unbounded_channel();

    if !reporter_config.full_batch {
        start_reporter_subset(&reporter_config, rx_batch)
    }

    loop {
        BATCH_COUNTER.inc();

        let start_time = Instant::now();

        if reporter_config.full_batch {
            dispatch_full_batch(&reporter_config, &feeds_registry, &mut connection_cache).await;
        } else {
            dispatch_subset(
                &reporter_config,
                &feeds_registry,
                &mut connection_cache,
                tx_batch.clone(),
            )
            .await;
        }

        info!("Finished with {}-th batch..\n", BATCH_COUNTER.get());

        let elapsed_time_ms = start_time.elapsed().as_millis();

        //TODO(snikolov): `poll_period_ms` is dependent on the feed, we should ship payload ASAP and sleep this feed only.
        if elapsed_time_ms < reporter_config.poll_period_ms.into() {
            let remaining_time_ms = reporter_config.poll_period_ms - (elapsed_time_ms as u64);
            info!("Remaining milliseconds in slot - {}", remaining_time_ms);
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
