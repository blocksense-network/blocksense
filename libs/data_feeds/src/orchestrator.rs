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
use utils::get_env_var;

use tracing::{debug, info};

use crate::{connector::dispatch::dispatch, interfaces::data_feed::DataFeed, types::DataFeedAPI};

pub async fn orchestrator() {
    // Initializes a tracing subscriber that displays runtime information based on the RUST_LOG env variable
    tracing_subscriber::fmt::init();

    let batch_size: usize = get_env_var("BATCH_SIZE").expect("BATCH_SIZE not set");
    let reporter_id: u64 = get_env_var("REPORTER_ID").expect("REPORTER_ID not set");

    let sequencer_url: String = get_env_var("SEQUENCER_URL").expect("SEQUENCER_URL not set");
    let poll_period_ms: u64 =
        get_env_var("POLL_PERIOD_MS").expect("POLL_PERIOD_MS env_variable not set");

    let mut connection_cache = HashMap::<DataFeedAPI, Rc<RefCell<dyn DataFeed>>>::new();

    let encoder = TextEncoder::new();

    let all_feeds = DataFeedAPI::get_all_feeds();
    debug!("All feeds dump - {:?}", all_feeds);

    FEED_COUNTER.inc_by((all_feeds).len() as u64);
    info!("Available feed count: {}\n", FEED_COUNTER.get());

    let prometheus_server = reqwest::Client::new();
    let prometheus_url =
        get_env_var::<String>("PROMETHEUS_URL_CLIENT").unwrap_or("127.0.0.1:8080".to_string());

    loop {
        BATCH_COUNTER.inc();

        let start_time = Instant::now();

        dispatch(
            reporter_id,
            sequencer_url.as_str(),
            batch_size,
            &all_feeds,
            &mut connection_cache,
        )
        .await;

        info!("Finished with {}-th batch..\n", BATCH_COUNTER.get());

        let elapsed_time = start_time.elapsed().as_millis();
        if elapsed_time < poll_period_ms.into() {
            let remaining_time_ms = poll_period_ms - (elapsed_time as u64);
            sleep(Duration::from_millis(remaining_time_ms));
        }

        UPTIME_COUNTER.inc_by(poll_period_ms as f64 / 1000.);
        BATCH_PARSE_TIME_GAUGE.set(elapsed_time as i64);

        let metrics_result =
            handle_prometheus_metrics(&prometheus_server, prometheus_url.as_str(), &encoder).await;
        if let Err(e) = metrics_result {
            debug!("Error handling Prometheus metrics: {:?}", e);
        };
    }
}
