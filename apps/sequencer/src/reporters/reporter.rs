use crate::reporters::reporter_metrics::ReporterMetrics;
use crypto::{deserialize_public_key, PublicKey, MULTIFORMATS_BLS_PUBKYE_PREFIX};
use sequencer_config::SequencerConfig;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug)]
pub struct Reporter {
    pub pub_key: PublicKey,
    pub reporter_metrics: ReporterMetrics,
}

pub type SharedReporter = Arc<RwLock<Reporter>>;

pub type Reporters = HashMap<u64, SharedReporter>;

pub type SharedReporters = Arc<RwLock<Reporters>>;

pub fn init_shared_reporters(conf: &SequencerConfig) -> SharedReporters {
    Arc::new(RwLock::new(init_reporters(conf)))
}

fn init_reporters(conf: &SequencerConfig) -> HashMap<u64, Arc<RwLock<Reporter>>> {
    let mut reporters = HashMap::new();
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
                reporter_metrics: ReporterMetrics::new(r.id.into())
                    .expect("Failed to allocate ReporterMetrics."),
            })),
        );
    }
    reporters
}
