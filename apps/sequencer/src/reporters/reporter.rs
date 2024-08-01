use crypto::{deserialize_public_key, PublicKey, MULTIFORMATS_BLS_PUBKYE_PREFIX};
use prometheus::metrics::ReporterMetrics;
use sequencer_config::SequencerConfig;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug)]
pub struct Reporter {
    pub pub_key: PublicKey,
    pub reporter_metrics: Arc<RwLock<ReporterMetrics>>,
}

pub type SharedReporter = Arc<RwLock<Reporter>>;

pub type Reporters = HashMap<u64, SharedReporter>;

pub type SharedReporters = Arc<RwLock<Reporters>>;

pub fn init_shared_reporters(conf: &SequencerConfig, prefix: Option<&str>) -> SharedReporters {
    let prefix = prefix.unwrap_or("");
    Arc::new(RwLock::new(init_reporters(conf, prefix)))
}

fn init_reporters(conf: &SequencerConfig, prefix: &str) -> HashMap<u64, Arc<RwLock<Reporter>>> {
    let mut reporters = HashMap::new();
    let reporter_metrics = Arc::new(std::sync::RwLock::new(
        ReporterMetrics::new(prefix).expect("Failed to allocate ReporterMetrics."),
    ));
    for r in &conf.reporters {
        reporters.insert(
            r.id.into(),
            Arc::new(RwLock::new(Reporter {
                pub_key: deserialize_public_key(
                    &r.pub_key
                        .strip_prefix(MULTIFORMATS_BLS_PUBKYE_PREFIX)
                        .expect("Multiformats key prefix error. Only BLS is currently supported."),
                )
                .expect("Pub key format error: "),
                reporter_metrics: reporter_metrics.clone(),
            })),
        );
    }
    reporters
}
