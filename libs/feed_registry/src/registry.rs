use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, SystemTime},
};

use crate::types::{FeedMetaData, FeedResult, FeedType, Repeatability};
use config::AllFeedsConfig;
use ringbuf::{storage::Heap, traits::RingBuffer, HeapRb, SharedRb};
use tokio::{sync::RwLock, time};
use tracing::{info, trace};
use utils::time::current_unix_time;

/// Map representing feed_id -> FeedMetaData
#[derive(Debug)]
pub struct FeedMetaDataRegistry {
    registered_feeds: HashMap<u32, Arc<RwLock<FeedMetaData>>>,
}

impl Default for FeedMetaDataRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl FeedMetaDataRegistry {
    pub fn new() -> FeedMetaDataRegistry {
        FeedMetaDataRegistry {
            registered_feeds: HashMap::new(),
        }
    }
    pub fn push(&mut self, id: u32, fd: FeedMetaData) {
        self.registered_feeds.insert(id, Arc::new(RwLock::new(fd)));
    }
    pub fn get(&self, id: u32) -> Option<Arc<RwLock<FeedMetaData>>> {
        self.registered_feeds.get(&id).cloned()
    }
    pub fn get_keys(&self) -> Vec<u32> {
        self.registered_feeds.keys().copied().collect()
    }
    pub fn remove(&mut self, id: u32) {
        self.registered_feeds.remove(&id);
    }
}

pub fn new_feeds_meta_data_reg_with_test_data() -> FeedMetaDataRegistry {
    let start = SystemTime::now();

    let fmd1 = FeedMetaData::new(
        "DOGE/USD",
        60000,
        0.6,
        start,
        "Numerical".to_string(),
        "Average".to_string(),
        None,
    );
    let fmd2 = FeedMetaData::new(
        "BTS/USD",
        30000,
        0.6,
        start,
        "Numerical".to_string(),
        "Average".to_string(),
        None,
    );
    let fmd3 = FeedMetaData::new(
        "ETH/USD",
        60000,
        0.6,
        start,
        "Numerical".to_string(),
        "Average".to_string(),
        None,
    );

    let mut fmdr = FeedMetaDataRegistry::new();

    fmdr.push(0, fmd1);
    fmdr.push(1, fmd2);
    fmdr.push(2, fmd3);

    fmdr
}

pub fn new_feeds_meta_data_reg_from_config(conf: &AllFeedsConfig) -> FeedMetaDataRegistry {
    let mut fmdr = FeedMetaDataRegistry::new();

    for feed in &conf.feeds {
        fmdr.push(
            feed.id,
            FeedMetaData::new(
                &feed.name,
                feed.report_interval_ms,
                feed.quorum_percentage,
                feed.first_report_start_time,
                feed.value_type.clone(),
                feed.aggregate_type.clone(),
                None, // Will be filled once FeedsSlotsManager is started and processors are up and running.
            ),
        );
    }

    fmdr
}

// For a given Feed this struct represents the received votes from different reporters.
#[derive(Debug)]
pub struct FeedReports {
    pub report: HashMap<u64, FeedResult>,
}

impl FeedReports {
    pub fn clear(&mut self) {
        self.report.clear();
    }
}

pub struct FeedAggregateHistory {
    aggregate_history: HashMap<u32, HeapRb<FeedType>>,
}

impl Default for FeedAggregateHistory {
    fn default() -> Self {
        Self::new()
    }
}

impl FeedAggregateHistory {
    pub fn new() -> Self {
        Self {
            aggregate_history: HashMap::new(),
        }
    }

    pub fn register_feed(&mut self, feed_id: u32, buf_size: usize) {
        let shared_rb = SharedRb::new(buf_size);

        self.aggregate_history.insert(feed_id, shared_rb);
    }

    pub fn deregister_feed(&mut self, feed_id: u32) {
        self.aggregate_history.remove(&feed_id);
    }

    pub fn collect(&self, feed_id: u32) -> Option<&SharedRb<Heap<FeedType>>> {
        self.aggregate_history.get(&feed_id)
    }

    pub fn push(&mut self, feed_id: u32, aggregate_result: FeedType) {
        if let Some(rb) = self.aggregate_history.get_mut(&feed_id) {
            // Push the aggregate_result into the ring buffer
            rb.push_overwrite(aggregate_result);
        } else {
            info!(
                "Feed Id: {}, not registered in FeedAggregateHistory!",
                feed_id
            );
        }
    }
}

// This struct holds all the Feeds by ID (the key in the map) and the received votes for them
#[derive(Debug)]
pub struct AllFeedsReports {
    reports: HashMap<u32, Arc<RwLock<FeedReports>>>,
}

impl Default for AllFeedsReports {
    fn default() -> Self {
        Self::new()
    }
}

impl AllFeedsReports {
    pub fn new() -> AllFeedsReports {
        AllFeedsReports {
            reports: HashMap::new(),
        }
    }
    pub async fn push(&mut self, feed_id: u32, reporter_id: u64, data: FeedResult) -> bool {
        let res = self.reports.entry(feed_id).or_insert_with(|| {
            Arc::new(RwLock::new(FeedReports {
                report: HashMap::new(),
            }))
        }); //TODO: Reject votes for unregistered feed ID-s
        let mut res = res.write().await;
        if let std::collections::hash_map::Entry::Vacant(e) = res.report.entry(reporter_id) {
            // Stick to first vote from a reporter.
            e.insert(data);
            return true;
        }
        false
    }
    pub fn get(&self, feed_id: u32) -> Option<Arc<RwLock<FeedReports>>> {
        self.reports.get(&feed_id).cloned()
    }
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

        let current_time_as_ms = current_unix_time();
        let slot_number = if *repeatability == Repeatability::Oneshot {
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
        self.start_time_ms = current_unix_time();
    }
}

#[cfg(test)]
mod tests {
    use utils::time::current_unix_time;

    use crate::registry::new_feeds_meta_data_reg_with_test_data;
    use crate::registry::AllFeedsReports;
    use crate::registry::SlotTimeTracker;
    use crate::types::FeedMetaData;
    use crate::types::FeedResult;
    use crate::types::FeedType;
    use crate::types::Repeatability;
    use crate::types::ReportRelevance;
    use std::sync::Arc;
    use std::time::Instant;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use tokio::sync::RwLock;

    const QUORUM_PERCENTAGE: f32 = 0.001;

    #[tokio::test]
    async fn basic_test() {
        let fmdr = new_feeds_meta_data_reg_with_test_data();

        let mut expected_keys_vec = vec![0, 1, 2];
        let mut actual_keys_vec = fmdr.get_keys().clone();

        expected_keys_vec.sort();
        actual_keys_vec.sort();
        assert_eq!(actual_keys_vec, expected_keys_vec);

        let mut current_time_as_ms = current_unix_time();

        println!("fmdr.get_keys()={:?}", fmdr);
        assert!(
            fmdr.get(0)
                .expect("ID not present in registry")
                .read()
                .await
                .get_slot(current_time_as_ms)
                == 0
        );
        assert!(
            fmdr.get(1)
                .expect("ID not present in registry")
                .read()
                .await
                .get_slot(current_time_as_ms)
                == 0
        );

        assert!(
            fmdr.get(0).expect("ID not present in registry").read().await.get_report_interval_ms() as u128 ==
            fmdr.get(1).expect("ID not present in registry").read().await.get_report_interval_ms() as u128 * 2,
            "The test expects that Feed ID 0 has twice longer report interval compared to Feed ID 1"
        );

        current_time_as_ms += fmdr
            .get(1)
            .expect("ID not present in registry")
            .read()
            .await
            .get_report_interval_ms() as u128
            + 1u128;
        assert!(
            fmdr.get(0)
                .expect("ID not present in registry")
                .read()
                .await
                .get_slot(current_time_as_ms)
                == 0
        );
        assert!(
            fmdr.get(1)
                .expect("ID not present in registry")
                .read()
                .await
                .get_slot(current_time_as_ms)
                == 1
        );
        current_time_as_ms += fmdr
            .get(1)
            .expect("ID not present in registry")
            .read()
            .await
            .get_report_interval_ms() as u128
            + 1u128;

        assert!(
            fmdr.get(0)
                .expect("ID not present in registry")
                .read()
                .await
                .get_slot(current_time_as_ms)
                == 1
        );
        assert!(
            fmdr.get(1)
                .expect("ID not present in registry")
                .read()
                .await
                .get_slot(current_time_as_ms)
                == 2
        );
    }

    #[tokio::test]
    async fn relevant_feed_check() {
        const DATA_FEED_ID: u32 = 1;

        let fmdr = new_feeds_meta_data_reg_with_test_data();

        let mut current_time_as_ms = current_unix_time();

        let mut msg_timestamp = current_time_as_ms;

        let feed = fmdr.get(DATA_FEED_ID).expect("ID not present in registry");

        println!("fmdr.get_keys()={:?}", fmdr);
        assert!(
            feed.read()
                .await
                .check_report_relevance(current_time_as_ms, msg_timestamp)
                == ReportRelevance::Relevant
        );

        current_time_as_ms += feed.read().await.report_interval_ms as u128 + 1; // Advance time, the report will become obsolete

        assert!(
            feed.read()
                .await
                .check_report_relevance(current_time_as_ms, msg_timestamp)
                == ReportRelevance::NonRelevantOld
        );

        msg_timestamp += feed.read().await.report_interval_ms as u128 + 1; // Advance report time to make it relevant

        assert!(
            feed.read()
                .await
                .check_report_relevance(current_time_as_ms, msg_timestamp)
                == ReportRelevance::Relevant
        );
    }

    #[test]
    fn test_relevant_oneshot_feed_check() {
        // setup
        let current_system_time = SystemTime::now();

        // voting will start in 60 seconds
        let voting_start_time = current_system_time
            .checked_add(Duration::from_secs(60))
            .unwrap();

        // voting will be 30 seconds long
        let voting_wait_duration_ms = 30000;

        let feed = FeedMetaData::new_oneshot(
            "TestFeed".to_string(),
            voting_wait_duration_ms,
            QUORUM_PERCENTAGE,
            voting_start_time,
        );

        assert_eq!(feed.get_name(), "TestFeed");

        let current_time_as_ms = current_unix_time();
        let msg_timestamp_as_ms = current_time_as_ms;

        // test
        // Note: current_time passed is irrelevant for Oneshot feeds because in those feeds there is only one slot.
        let irrelevant_current_timestamp = current_time_as_ms;

        // test old message for oneshot feed
        // NOW                            MESSAGE
        //  |                                |
        //  v                                v
        // 0s -------|-------|-------|-------|-------|-------|-------|-------|-------|-------|---
        //           10s     20s     30s     40s     50s     60s     70s     80s     90s    100s
        //                                                   [===== VOTING SLOT =====]

        let message_with_old_timestamp = msg_timestamp_as_ms + 40000;
        assert_eq!(
            feed.check_report_relevance(irrelevant_current_timestamp, message_with_old_timestamp),
            ReportRelevance::NonRelevantOld
        );

        // test relevant message for oneshot feed
        // NOW                                                    MESSAGE
        //  |                                                        |
        //  v                                                        v
        // 0s -------|-------|-------|-------|-------|-------|-------|-------|-------|-------|---
        //           10s     20s     30s     40s     50s     60s     70s     80s     90s    100s
        //                                                   [===== VOTING SLOT =====]

        let message_with_current_timestamp = voting_start_time
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis()
            + 10000;
        assert_eq!(
            feed.check_report_relevance(
                irrelevant_current_timestamp,
                message_with_current_timestamp
            ),
            ReportRelevance::Relevant
        );

        // test future message for oneshot feed
        // NOW                                                                            MESSAGE
        //  |                                                                                |
        //  v                                                                                v
        // 0s -------|-------|-------|-------|-------|-------|-------|-------|-------|-------|---
        //           10s     20s     30s     40s     50s     60s     70s     80s     90s    100s
        //                                                   [===== VOTING SLOT =====]

        let message_with_future_timestamp = voting_start_time
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis()
            + 40000;
        assert_eq!(
            feed.check_report_relevance(
                irrelevant_current_timestamp,
                message_with_future_timestamp
            ),
            ReportRelevance::NonRelevantInFuture
        );
    }

    #[test]
    fn test_time_to_slot_end_ms() {
        // setup
        let current_system_time = SystemTime::now();
        let current_time_as_ms = current_system_time
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();

        // voting will start in 60 seconds
        let voting_start_time = current_system_time
            .checked_add(Duration::from_secs(60))
            .unwrap();

        // voting will be 30 seconds long
        let voting_wait_duration_ms = 30000;

        let oneshot_feed = FeedMetaData::new_oneshot(
            "TestFeed".to_string(),
            voting_wait_duration_ms,
            QUORUM_PERCENTAGE,
            voting_start_time,
        );
        let regular_feed = FeedMetaData::new(
            "TestFeed",
            voting_wait_duration_ms,
            QUORUM_PERCENTAGE,
            current_system_time,
            "Numeric".to_string(),
            "Average".to_string(),
            None,
        );

        // setup messages
        let message_with_old_timestamp = current_time_as_ms + 40000;
        let message_with_current_timestamp = voting_start_time
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis()
            + 10000;
        let message_with_future_timestamp = voting_start_time
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis()
            + 40000;

        // test oneshot feeds
        assert_eq!(
            FeedMetaData::time_to_slot_end_ms(&oneshot_feed, message_with_old_timestamp),
            50000
        );
        assert_eq!(
            FeedMetaData::time_to_slot_end_ms(&oneshot_feed, message_with_current_timestamp),
            20000
        );
        assert_eq!(
            FeedMetaData::time_to_slot_end_ms(&oneshot_feed, message_with_future_timestamp),
            -10000
        );

        // test regular feeds can never return negative time_to_slot_end_ms
        assert_eq!(
            FeedMetaData::time_to_slot_end_ms(&regular_feed, message_with_old_timestamp),
            20000
        );
        assert_eq!(
            FeedMetaData::time_to_slot_end_ms(&regular_feed, message_with_current_timestamp),
            20000
        );
        assert_eq!(
            FeedMetaData::time_to_slot_end_ms(&regular_feed, message_with_future_timestamp),
            20000
        );
    }

    #[tokio::test]
    async fn check_relevant_and_insert_mt() {
        const NTHREADS: u32 = 10;
        const DATA_FEED_ID: u32 = 1;

        let fmdr = Arc::new(RwLock::new(new_feeds_meta_data_reg_with_test_data()));
        let reports = Arc::new(RwLock::new(AllFeedsReports::new()));

        let mut children = vec![];

        for i in 0..NTHREADS {
            let fmdr = fmdr.clone();
            let reports = reports.clone();

            let msg_timestamp = current_unix_time();

            children.push(tokio::spawn(async move {
                let feed = fmdr
                    .read()
                    .await
                    .get(0)
                    .expect("ID not present in registry");

                let current_time_as_ms = msg_timestamp + i as u128;

                assert!(
                    feed.read()
                        .await
                        .check_report_relevance(current_time_as_ms, msg_timestamp)
                        == ReportRelevance::Relevant
                );

                reports
                    .write()
                    .await
                    .push(
                        DATA_FEED_ID,
                        i.into(),
                        FeedResult::Result {
                            result: FeedType::Numerical(0.1),
                        },
                    )
                    .await;

                println!("this is thread number {}", i);
            }));
        }

        let _ = futures::future::join_all(children).await;

        let reports = reports.write().await;
        let reports = reports
            .get(DATA_FEED_ID)
            .expect("ID not present in registry");
        let reports = reports.read().await;
        // Process the reports:
        let mut values: Vec<&FeedResult> = vec![];
        for kv in &reports.report {
            values.push(kv.1);
        }
        assert!(values.len() as u32 == NTHREADS);
    }

    #[tokio::test]
    async fn test_await_end_of_current_slot() {
        // setup
        const SLOT_INTERVAL: Duration = Duration::from_secs(1);
        const START_TIME_MS: u128 = 0;
        let time_tracker = SlotTimeTracker::new(SLOT_INTERVAL, START_TIME_MS);

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
        let start_time_ms: u128 = current_unix_time() + 6000;
        let time_tracker = SlotTimeTracker::new(slot_interval, start_time_ms);

        // run
        let duration_ms =
            time_tracker.get_duration_until_end_of_current_slot(&Repeatability::Oneshot);
        // assert
        assert!((8000..=10000).contains(&duration_ms));

        tokio::time::sleep(Duration::from_millis(7000)).await;

        // run
        let duration_ms =
            time_tracker.get_duration_until_end_of_current_slot(&Repeatability::Oneshot);
        // assert
        assert!((1000..=3000).contains(&duration_ms));

        tokio::time::sleep(Duration::from_millis(3000)).await;

        // run
        let duration_ms =
            time_tracker.get_duration_until_end_of_current_slot(&Repeatability::Oneshot);
        // assert
        assert!(duration_ms < 0);
    }
}
