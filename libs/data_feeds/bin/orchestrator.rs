use std::{
    collections::HashMap,
    rc::Rc,
    thread::sleep,
    time::{Duration, Instant},
};

use data_feeds::{
    connector::data_feed::{dispatch, DataFeed},
    types::DataFeedAPI,
    utils::{get_env_var, handle_prometheus_metrics},
};

use prometheus::{
    register_counter, register_int_counter, register_int_gauge, Counter, IntCounter, IntGauge,
    TextEncoder,
};

lazy_static::lazy_static! {
    static ref BATCH_COUNTER: IntCounter =
        register_int_counter!("BATCH_COUNTER", "number of batches served").unwrap();

    static ref BATCH_SIZE: IntCounter =
        register_int_counter!("FEED_COUNTER", "Available feed count").unwrap();

    static ref FEED_COUNTER: IntCounter =
        register_int_counter!("FEED_COUNTER", "Available feed count").unwrap();

    static ref UPTIME_COUNTER: Counter =
        register_counter!("UPTIME_COUNTER", "Runtime(sec) duration of reporter").unwrap();

    static ref BATCH_PARSE_TIME_GAUGE: IntGauge = register_int_gauge!("BATCH_PARSE_TIME_GAUGE", "Time(ms) to parse current batch").unwrap();
}

#[tokio::main]
async fn main() {
    let batch_size: usize = get_env_var("BATCH_SIZE").unwrap_or_else(|_| 5);
    let reporter_id: u64 = get_env_var("REPORTER_ID").unwrap_or_else(|_| 0);

    let sequencer_url: String = get_env_var("SEQUENCER_URL").unwrap();
    let poll_period_ms: u64 = get_env_var("POLL_PERIOD_MS").unwrap();

    let mut connection_cache = HashMap::<DataFeedAPI, Rc<dyn DataFeed>>::new();

    let encoder = TextEncoder::new();

    let all_feeds = DataFeedAPI::get_all_feeds();

    FEED_COUNTER.inc_by((&all_feeds).len() as u64);
    println!("Available feed count: {}\n", FEED_COUNTER.get());

    let prometheus_server = reqwest::Client::new();
    let prometheus_url =
        get_env_var::<String>("PROMETHEUS_URL").unwrap_or("127.0.0.1:8080".to_string());

    loop {
        BATCH_COUNTER.inc();

        let start_time = Instant::now();

        dispatch(
            &reporter_id,
            sequencer_url.as_str(),
            &batch_size,
            &all_feeds,
            &mut connection_cache,
        )
        .await;

        println!("Finished with {}-th batch..\n", BATCH_COUNTER.get());

        let elapsed_time = start_time.elapsed().as_millis();
        if elapsed_time < poll_period_ms.into() {
            let remaining_time_ms = poll_period_ms - (elapsed_time as u64);
            sleep(Duration::from_millis(remaining_time_ms));
        }

        UPTIME_COUNTER.inc_by(poll_period_ms as f64 / 1000.);
        BATCH_PARSE_TIME_GAUGE.set(elapsed_time as i64);

        let _ =
            handle_prometheus_metrics(&prometheus_server, prometheus_url.as_str(), &encoder).await;
    }
}
