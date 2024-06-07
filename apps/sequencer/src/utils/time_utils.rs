use std::time::{SystemTime, UNIX_EPOCH};

pub fn get_ms_since_epoch() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("System clock set before EPOCH")
        .as_millis()
}
