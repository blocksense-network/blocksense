use std::{
    collections::HashMap,
    rc::Rc,
    thread::sleep,
    time::{Duration, Instant},
};

use data_feeds::{
    connector::data_feed::{dispatch, DataFeed},
    types::DataFeedAPI,
    utils::get_env_var,
};

use prometheus::{
    register_counter, register_int_counter, register_int_gauge, register_int_gauge_vec, Counter,
    IntCounter, IntGauge, IntGaugeVec,
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
    let sequencer_url = get_env_var("SEQUENCER_URL");
    let poll_period_ms = get_env_var("POLL_PERIOD_MS").parse::<u64>().unwrap();
    let batch_size = get_env_var("BATCH_SIZE").parse::<usize>().unwrap();

    let mut connection_cache = HashMap::<DataFeedAPI, Rc<dyn DataFeed>>::new();

    let all_feeds = DataFeedAPI::get_all_feeds();

    FEED_COUNTER.inc_by((&all_feeds).len() as u64);
    println!("Available feed count: {}", FEED_COUNTER.get());

    loop {
        BATCH_COUNTER.inc();

        let start_time = Instant::now();

        dispatch(
            sequencer_url.as_str(),
            batch_size,
            &all_feeds,
            &mut connection_cache,
        )
        .await;

        println!("Finished with {}-th batch..", BATCH_COUNTER.get());

        let elapsed_time = start_time.elapsed().as_millis();
        if elapsed_time < poll_period_ms.into() {
            let remaining_time_ms = poll_period_ms - (elapsed_time as u64);
            sleep(Duration::from_millis(remaining_time_ms));
        }

        // DATA_FEEDS_PARSE_TIME_GAUGE.with_label_values(&["a"]).set(10);
        // DATA_FEEDS_PARSE_TIME_GAUGE.with_label_values(&["b"]).set(100);
        // println!("DATA_FEEDS_PARSE_TIME_GAUGE: {}", DATA_FEEDS_PARSE_TIME_GAUGE.with_label_values(&["a"]).get());
        // println!("DATA_FEEDS_PARSE_TIME_GAUGE: {}", DATA_FEEDS_PARSE_TIME_GAUGE.with_label_values(&["b"]).get());

        UPTIME_COUNTER.inc_by(poll_period_ms as f64 / 1000.);
        BATCH_PARSE_TIME_GAUGE.set(elapsed_time as i64);
    }
}
