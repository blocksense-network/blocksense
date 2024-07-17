use actix_web::rt::time;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::time::Duration;
use tracing::trace;

pub fn get_ms_since_epoch() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("System clock set before EPOCH")
        .as_millis()
}

pub struct SlotTimeTracker {
    slot_interval: Duration,
    start_time_ms: u128,
}

impl SlotTimeTracker {
    pub fn new(slot_interval: Duration, start_time_ms: u128) -> SlotTimeTracker {
        SlotTimeTracker {
            slot_interval,
            start_time_ms,
        }
    }
    pub async fn await_end_of_current_slot(&self) {
        let mut interval = time::interval(self.get_duration_until_end_of_current_slot());
        interval.tick().await; // The first tick completes immediately.
        interval.tick().await;
    }

    pub fn get_duration_until_end_of_current_slot(&self) -> Duration {
        let current_time_as_ms = get_ms_since_epoch();
        let slots_count =
            (current_time_as_ms - self.start_time_ms) / self.slot_interval.as_millis();
        let current_slot_start_time =
            self.start_time_ms + slots_count * self.slot_interval.as_millis();
        let current_slot_end_time = current_slot_start_time + self.slot_interval.as_millis();

        trace!("current_time_as_ms      = {}", current_time_as_ms);
        trace!("slots_count             = {}", slots_count);
        trace!("current_slot_start_time = {}", current_slot_start_time);
        trace!("current_slot_end_time   = {}", current_slot_end_time);
        trace!(
            "uncorrected sleep time  = {}",
            current_time_as_ms + self.slot_interval.as_millis()
        );
        trace!(
            "diff                    = {}",
            current_time_as_ms + self.slot_interval.as_millis() - current_slot_end_time
        );

        Duration::from_millis((current_slot_end_time - current_time_as_ms) as u64)
    }

    pub fn reset_report_start_time(&mut self) {
        self.start_time_ms = get_ms_since_epoch();
    }
}

#[cfg(test)]
mod tests {
    use super::SlotTimeTracker;
    use std::time::{Duration, Instant};

    #[tokio::test]
    async fn test_await_end_of_current_slot() {
        // setup
        const SLOT_INTERVAL: Duration = Duration::from_secs(1);
        const START_TIME_MS: u128 = 0;
        let mut time_tracker = SlotTimeTracker::new(SLOT_INTERVAL, START_TIME_MS);

        // run
        let start_time = Instant::now();
        time_tracker.await_end_of_current_slot().await;
        let elapsed_time = start_time.elapsed();

        // assert
        assert!(
            elapsed_time
                < SLOT_INTERVAL
                    .checked_add(Duration::from_millis(100))
                    .unwrap()
        );
    }

    #[tokio::test]
    async fn test_get_duration_until_end_of_current_slot() {
        // setup
        const SLOT_INTERVAL: Duration = Duration::from_secs(1);
        const START_TIME_MS: u128 = 0;
        let mut time_tracker = SlotTimeTracker::new(SLOT_INTERVAL, START_TIME_MS);

        // run
        let duration = time_tracker.get_duration_until_end_of_current_slot();

        // assert
        assert!(duration.as_secs() < SLOT_INTERVAL.as_secs());

        // setup
        time_tracker.reset_report_start_time();
        let duration = time_tracker.get_duration_until_end_of_current_slot();

        // assert
        // Should be ideally exactly SLOT_INTERVAL ms, but we cannot count on exactness
        assert!(duration.as_millis() > (SLOT_INTERVAL.as_millis() - 100));
    }
}
