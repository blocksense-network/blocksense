use std::time::{SystemTime, UNIX_EPOCH};

pub fn current_unix_time() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("SystemTime before UNIX EPOCH!")
        .as_secs() as u128
}
