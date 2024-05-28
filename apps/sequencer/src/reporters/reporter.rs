use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug)]
pub struct Reporter {
    pub pub_key: String,
}

pub type SharedReporters = Arc<RwLock<HashMap<u64, Arc<RwLock<Reporter>>>>>;

pub fn get_shared_reporters() -> SharedReporters {
    Arc::new(RwLock::new(get_reporters()))
}

fn get_reporters() -> HashMap<u64, Arc<RwLock<Reporter>>> {
    let mut reporters = HashMap::new();
    for i in 0..30 {
        reporters.insert(
            i as u64,
            Arc::new(RwLock::new(Reporter {
                pub_key: "".to_string(),
            })),
        );
    }
    reporters
}
