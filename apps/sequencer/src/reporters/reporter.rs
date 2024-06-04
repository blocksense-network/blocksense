use crate::reporters::reporter_metrics::ReporterMetrics;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug)]
pub struct Reporter {
    pub pub_key: String,
    pub reporter_metrics: ReporterMetrics,
}

#[macro_export]
macro_rules! inc_reporter_metric (
    ($_reporter: ident, $_metric: ident) => (
        $_reporter
        .read() // Holding a read lock here suffice, since the counters are atomic.
        .unwrap()
        .reporter_metrics
        .$_metric
        .inc();
    );
);

#[macro_export]
macro_rules! inc_reporter_vec_metric (
    ($_reporter: ident, $_metric: ident, $_index: ident) => (
        $_reporter
        .read() // Holding a read lock here suffice, since the counters are atomic.
        .unwrap()
        .reporter_metrics
        .$_metric
        .with_label_values(&[&$_index.to_string()])
        .inc();
    );
);

pub type SharedReporters = Arc<RwLock<HashMap<u64, Arc<RwLock<Reporter>>>>>;

pub fn init_shared_reporters() -> SharedReporters {
    Arc::new(RwLock::new(init_reporters()))
}

fn init_reporters() -> HashMap<u64, Arc<RwLock<Reporter>>> {
    let mut reporters = HashMap::new();
    for i in 0..30 {
        reporters.insert(
            i as u64,
            Arc::new(RwLock::new(Reporter {
                pub_key: "".to_string(),
                reporter_metrics: ReporterMetrics::new(i),
            })),
        );
    }
    reporters
}
