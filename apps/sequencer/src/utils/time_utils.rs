use std::time::{SystemTime, UNIX_EPOCH};

pub fn get_ms_since_epoch() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis()
}

pub struct TimeIntervalMeasure {
    start: u128,
}

impl TimeIntervalMeasure {
    pub fn new() -> TimeIntervalMeasure {
        TimeIntervalMeasure {
            start: get_ms_since_epoch(),
        }
    }
    pub fn measure(&self) -> u128 {
        get_ms_since_epoch() - self.start
    }
}
