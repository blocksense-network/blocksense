use std::time::{SystemTime, UNIX_EPOCH};

pub fn system_time_to_millis(time: SystemTime) -> u128 {
    time.duration_since(UNIX_EPOCH)
        .expect("SystemTime before UNIX EPOCH!")
        .as_millis()
}

pub fn current_unix_time() -> u128 {
    system_time_to_millis(SystemTime::now())
}
