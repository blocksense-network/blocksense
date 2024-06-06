use prometheus::{
    register_counter, register_int_counter, register_int_gauge, register_int_gauge_vec, Counter,
    IntCounter, IntGauge, IntGaugeVec,
};

lazy_static::lazy_static! {
    pub static ref DATA_FEED_PARSE_TIME_GAUGE: IntGaugeVec = register_int_gauge_vec!("DATA_FEED_PARSE_TIME_GAUGE", "Time(ms) to parse current feed",&["Feed"]).unwrap();
}

lazy_static::lazy_static! {
    pub static ref BATCH_COUNTER: IntCounter =
        register_int_counter!("BATCH_COUNTER", "number of batches served").unwrap();

        pub static ref BATCH_SIZE: IntCounter =
        register_int_counter!("FEED_COUNTER", "Available feed count").unwrap();

        pub static ref FEED_COUNTER: IntCounter =
        register_int_counter!("FEED_COUNTER", "Available feed count").unwrap();

        pub  static ref UPTIME_COUNTER: Counter =
        register_counter!("UPTIME_COUNTER", "Runtime(sec) duration of reporter").unwrap();

        pub static ref BATCH_PARSE_TIME_GAUGE: IntGauge = register_int_gauge!("BATCH_PARSE_TIME_GAUGE", "Time(ms) to parse current batch").unwrap();
}
