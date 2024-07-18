use crate::feeds::feeds_registry::Repeatability;
use crate::feeds::feeds_registry::Repeatability::Oneshot;
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
    pub async fn await_end_of_current_slot(&self, repeatability: &Repeatability) {
        let end_of_voting_slot_ms: i128 =
            self.get_duration_until_end_of_current_slot(repeatability);
        // Cannot await negative amount of milliseconds; Turn negative to zero;
        let time_to_await_ms: u64 = if end_of_voting_slot_ms > 0 {
            end_of_voting_slot_ms as u64
        } else {
            0
        };
        let time_to_await: Duration = Duration::from_millis(time_to_await_ms);
        let mut interval = time::interval(time_to_await);
        interval.tick().await; // The first tick completes immediately.
        interval.tick().await;
    }

    // Return the number of milliseconds until the end of the voting slot.
    // Will always be positive for Periodic Feeds but can be negative for Oneshot feeds.
    pub fn get_duration_until_end_of_current_slot(&self, repeatability: &Repeatability) -> i128 {
        //TODO: At some point we should delegate this calculation to FeedMetaData::time_to_slot_end_ms

        let current_time_as_ms = get_ms_since_epoch();
        let slot_number = if *repeatability == Oneshot {
            0
        } else {
            (current_time_as_ms - self.start_time_ms) / self.slot_interval.as_millis()
        };

        let current_slot_start_time =
            self.start_time_ms + slot_number * self.slot_interval.as_millis();
        let current_slot_end_time = current_slot_start_time + self.slot_interval.as_millis();
        let result_ms = current_slot_end_time as i128 - current_time_as_ms as i128;

        trace!("current_time_as_ms      = {}", current_time_as_ms);
        trace!("slots_count             = {}", slot_number);
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

        result_ms
    }

    pub fn reset_report_start_time(&mut self) {
        self.start_time_ms = get_ms_since_epoch();
    }
}

#[cfg(test)]
mod tests {
    use super::SlotTimeTracker;
    use crate::feeds::feeds_registry::Repeatability;
    use std::time::{Duration, Instant};

    #[tokio::test]
    async fn test_await_end_of_current_slot() {
        // setup
        const SLOT_INTERVAL: Duration = Duration::from_secs(1);
        const START_TIME_MS: u128 = 0;
        let mut time_tracker = SlotTimeTracker::new(SLOT_INTERVAL, START_TIME_MS);

        // run
        let start_time = Instant::now();
        time_tracker
            .await_end_of_current_slot(&Repeatability::Periodic)
            .await;
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
    async fn test_get_duration_until_end_of_current_slot_periodic() {
        // setup
        const SLOT_INTERVAL: Duration = Duration::from_secs(1);
        const START_TIME_MS: u128 = 0;
        let mut time_tracker = SlotTimeTracker::new(SLOT_INTERVAL, START_TIME_MS);

        // run
        let duration_ms =
            time_tracker.get_duration_until_end_of_current_slot(&Repeatability::Periodic);
        // assert
        assert!(duration_ms < SLOT_INTERVAL.as_millis() as i128);

        // setup
        time_tracker.reset_report_start_time();
        let duration_ms =
            time_tracker.get_duration_until_end_of_current_slot(&Repeatability::Periodic);
        // assert
        // Should be ideally exactly SLOT_INTERVAL ms, but we cannot count on exactness
        assert!(duration_ms > (SLOT_INTERVAL.as_millis() as i128 - 100));
        assert!(duration_ms < (SLOT_INTERVAL.as_millis() as i128 + 100));
    }

    #[tokio::test]
    async fn test_get_duration_until_end_of_current_slot_oneshot() {
        // setup
        let slot_interval: Duration = Duration::from_secs(3);
        let start_time_ms: u128 = super::get_ms_since_epoch() + 6000;
        let mut time_tracker = SlotTimeTracker::new(slot_interval, start_time_ms);

        // run
        let duration_ms =
            time_tracker.get_duration_until_end_of_current_slot(&Repeatability::Oneshot);
        // assert
        assert!(duration_ms >= 8000 && duration_ms <= 10000);

        tokio::time::sleep(Duration::from_millis(7000)).await;

        // run
        let duration_ms =
            time_tracker.get_duration_until_end_of_current_slot(&Repeatability::Oneshot);
        // assert
        assert!(duration_ms >= 1000 && duration_ms <= 3000);

        tokio::time::sleep(Duration::from_millis(3000)).await;

        // run
        let duration_ms =
            time_tracker.get_duration_until_end_of_current_slot(&Repeatability::Oneshot);
        // assert
        assert!(duration_ms < 0);
    }
}
