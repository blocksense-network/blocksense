use crate::reporters::reporter_metrics::ReporterMetrics;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug)]
pub struct Reporter {
    pub pub_key: String,
    pub reporter_metrics: ReporterMetrics,
}

pub type SharedReporter = Arc<RwLock<Reporter>>;

pub type Reporters = HashMap<u64, SharedReporter>;

pub type SharedReporters = Arc<RwLock<Reporters>>;

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
