use data_feeds::services::aggregate::{AverageAggregator, FeedAggregate};
use feed_registry::types::FeedType;
use ringbuf::storage::Heap;
use ringbuf::traits::RingBuffer;
use ringbuf::{HeapRb, SharedRb};
use sequencer_config::SequencerConfig;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{debug, info};

#[derive(Debug)]
pub struct FeedMetaData {
    name: String,
    voting_repeatability: Repeatability,
    report_interval_ms: u64, // Consider oneshot feeds.
    first_report_start_time: SystemTime,
    feed_type: Box<dyn FeedAggregate>,
}

#[derive(Debug, PartialEq, Copy, Clone)]
pub enum Repeatability {
    Periodic, // Has infinite number of voting slots
    Oneshot,  // Has only one voting slot
}

#[derive(Debug, PartialEq)]
pub enum ReportRelevance {
    Relevant,
    NonRelevantOld,
    NonRelevantInFuture,
}

impl FeedMetaData {
    pub fn new_oneshot(
        n: &str,
        r: u64, // Consider oneshot feeds.
        f: SystemTime,
    ) -> FeedMetaData {
        FeedMetaData {
            name: n.to_string(),
            voting_repeatability: Repeatability::Oneshot,
            report_interval_ms: r,
            first_report_start_time: f,
            feed_type: Box::new(AverageAggregator {}),
        }
    }

    pub fn new(
        n: &str,
        r: u64, // Consider oneshot feeds.
        f: SystemTime,
    ) -> FeedMetaData {
        FeedMetaData {
            name: n.to_string(),
            voting_repeatability: Repeatability::Periodic,
            report_interval_ms: r,
            first_report_start_time: f,
            feed_type: Box::new(AverageAggregator {}), //TODO(snikolov): This should be resolved based upon the ConsensusMetric enum sent from the reporter or directly based on the feed_id
        }
    }

    pub fn get_name(&self) -> &String {
        &self.name
    }
    pub fn get_report_interval_ms(&self) -> u64 {
        self.report_interval_ms
    }
    pub fn get_first_report_start_time_ms(&self) -> u128 {
        let since_the_epoch = self
            .first_report_start_time
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards");
        since_the_epoch.as_millis()
    }
    pub fn get_slot(&self, current_time_as_ms: u128) -> u64 {
        if self.voting_repeatability == Repeatability::Oneshot {
            // Oneshots only have the zero slot
            return 0;
        }
        ((current_time_as_ms - self.get_first_report_start_time_ms())
            / self.report_interval_ms as u128) as u64
    }
    pub fn get_feed_type(&self) -> &dyn FeedAggregate {
        self.feed_type.as_ref()
    }
    pub fn check_report_relevance(
        &self,
        current_time_as_ms: u128,
        msg_timestamp: u128,
    ) -> ReportRelevance {
        let start_of_voting_round = self.get_first_report_start_time_ms()
            + (self.get_slot(current_time_as_ms) as u128 * self.get_report_interval_ms() as u128);
        let end_of_voting_round = start_of_voting_round + self.get_report_interval_ms() as u128;

        if msg_timestamp < start_of_voting_round {
            debug!("Rejected report, time stamp is in a past slot.");
            return ReportRelevance::NonRelevantOld;
        }
        if msg_timestamp > end_of_voting_round {
            debug!("Rejected report, time stamp is in a future slot.");
            return ReportRelevance::NonRelevantInFuture;
        }
        debug!("Accepted report!");
        ReportRelevance::Relevant
    }

    // Return time to slot end. Can be negative for Oneshot feeds in the past.
    pub fn time_to_slot_end_ms(feed_meta_data: &FeedMetaData, timestamp_as_ms: u128) -> i128 {
        let start_of_voting_round = feed_meta_data.get_first_report_start_time_ms()
            + (feed_meta_data.get_slot(timestamp_as_ms) as u128
                * feed_meta_data.get_report_interval_ms() as u128);
        let end_of_voting_round =
            start_of_voting_round + feed_meta_data.get_report_interval_ms() as u128;
        end_of_voting_round as i128 - timestamp_as_ms as i128
    }

    // Return if this Feed is Oneshot.
    pub fn is_oneshot(&self) -> bool {
        self.voting_repeatability == Repeatability::Oneshot
    }
}

// map representing feed_id -> FeedMetaData
#[derive(Debug)]
pub struct FeedMetaDataRegistry {
    registered_feeds: HashMap<u32, Arc<RwLock<FeedMetaData>>>,
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
}

pub fn new_feeds_meta_data_reg_with_test_data() -> FeedMetaDataRegistry {
    let start = SystemTime::now();

    let fmd1 = FeedMetaData::new("DOGE/USD", 60000, start);
    let fmd2 = FeedMetaData::new("BTS/USD", 30000, start);
    let fmd3 = FeedMetaData::new("ETH/USD", 60000, start);

    let mut fmdr = FeedMetaDataRegistry::new();

    fmdr.push(0, fmd1);
    fmdr.push(1, fmd2);
    fmdr.push(2, fmd3);

    fmdr
}

pub fn new_feeds_meta_data_reg_from_config(conf: &SequencerConfig) -> FeedMetaDataRegistry {
    let mut fmdr = FeedMetaDataRegistry::new();

    for feed in &conf.feeds {
        fmdr.push(
            feed.id,
            FeedMetaData::new(
                &feed.name,
                feed.report_interval_ms,
                feed.first_report_start_time,
            ),
        );
    }

    fmdr
}

// For a given Feed this struct represents the received votes from different reporters.
#[derive(Debug)]
pub struct FeedReports {
    pub report: HashMap<u64, FeedType>,
}

impl FeedReports {
    pub fn clear(&mut self) {
        self.report.clear();
    }
}

pub struct FeedAggregateHistory {
    aggregate_history: HashMap<u32, HeapRb<FeedType>>,
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

impl AllFeedsReports {
    pub fn new() -> AllFeedsReports {
        AllFeedsReports {
            reports: HashMap::new(),
        }
    }
    pub fn push(&mut self, feed_id: u32, reporter_id: u64, data: FeedType) -> bool {
        let res = self.reports.entry(feed_id).or_insert_with(|| {
            Arc::new(RwLock::new(FeedReports {
                report: HashMap::new(),
            }))
        }); //TODO: Reject votes for unregistered feed ID-s
        let mut res = res.write().unwrap();
        if !res.report.contains_key(&reporter_id) {
            // Stick to first vote from a reporter.
            res.report.insert(reporter_id, data);
            return true;
        }
        false
    }
    pub fn get(&self, feed_id: u32) -> Option<Arc<RwLock<FeedReports>>> {
        self.reports.get(&feed_id).cloned()
    }
}

pub fn get_feed_id(name: &str) -> Option<u32> {
    if name.contains("YahooFinance.DOGE/USDC") {
        return Some(0);
    } else if name.contains("YahooFinance.BTC/USD") {
        return Some(1);
    } else if name.contains("YahooFinance.ETH/USD") {
        return Some(2);
    }
    None
    // TODO: get from registry
}

#[cfg(test)]
mod tests {
    use data_feeds::types::FeedType;

    use crate::feeds::feeds_registry::{
        new_feeds_meta_data_reg_with_test_data, AllFeedsReports, FeedMetaData, ReportRelevance,
    };
    use crate::utils::time_utils::get_ms_since_epoch;
    use std::sync::Arc;
    use std::sync::RwLock;
    use std::thread;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    #[test]
    fn basic_test() {
        let fmdr = new_feeds_meta_data_reg_with_test_data();

        let mut expected_keys_vec = vec![0, 1, 2];
        let mut actual_keys_vec = fmdr.get_keys().clone();

        expected_keys_vec.sort();
        actual_keys_vec.sort();
        assert_eq!(actual_keys_vec, expected_keys_vec);

        let mut current_time_as_ms = get_ms_since_epoch();

        println!("fmdr.get_keys()={:?}", fmdr);
        assert!(
            fmdr.get(0)
                .expect("ID not present in registry")
                .read()
                .unwrap()
                .get_slot(current_time_as_ms)
                == 0
        );
        assert!(
            fmdr.get(1)
                .expect("ID not present in registry")
                .read()
                .unwrap()
                .get_slot(current_time_as_ms)
                == 0
        );

        assert!(
            fmdr.get(0).expect("ID not present in registry").read().unwrap().get_report_interval_ms() as u128 ==
            fmdr.get(1).expect("ID not present in registry").read().unwrap().get_report_interval_ms() as u128 * 2,
            "The test expects that Feed ID 0 has twice longer report interval compared to Feed ID 1"
        );

        current_time_as_ms += fmdr
            .get(1)
            .expect("ID not present in registry")
            .read()
            .unwrap()
            .get_report_interval_ms() as u128
            + 1u128;
        assert!(
            fmdr.get(0)
                .expect("ID not present in registry")
                .read()
                .unwrap()
                .get_slot(current_time_as_ms)
                == 0
        );
        assert!(
            fmdr.get(1)
                .expect("ID not present in registry")
                .read()
                .unwrap()
                .get_slot(current_time_as_ms)
                == 1
        );
        current_time_as_ms += fmdr
            .get(1)
            .expect("ID not present in registry")
            .read()
            .unwrap()
            .get_report_interval_ms() as u128
            + 1u128;

        assert!(
            fmdr.get(0)
                .expect("ID not present in registry")
                .read()
                .unwrap()
                .get_slot(current_time_as_ms)
                == 1
        );
        assert!(
            fmdr.get(1)
                .expect("ID not present in registry")
                .read()
                .unwrap()
                .get_slot(current_time_as_ms)
                == 2
        );
    }

    #[test]
    fn relevant_feed_check() {
        const DATA_FEED_ID: u32 = 1;

        let fmdr = new_feeds_meta_data_reg_with_test_data();

        let mut current_time_as_ms = get_ms_since_epoch();

        let mut msg_timestamp = current_time_as_ms;

        let feed = fmdr.get(DATA_FEED_ID).expect("ID not present in registry");

        println!("fmdr.get_keys()={:?}", fmdr);
        assert!(
            feed.read()
                .unwrap()
                .check_report_relevance(current_time_as_ms, msg_timestamp)
                == ReportRelevance::Relevant
        );

        current_time_as_ms += feed.read().unwrap().report_interval_ms as u128 + 1; // Advance time, the report will become obsolete

        assert!(
            feed.read()
                .unwrap()
                .check_report_relevance(current_time_as_ms, msg_timestamp)
                == ReportRelevance::NonRelevantOld
        );

        msg_timestamp += feed.read().unwrap().report_interval_ms as u128 + 1; // Advance report time to make it relevant

        assert!(
            feed.read()
                .unwrap()
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

        let feed =
            FeedMetaData::new_oneshot("TestFeed", voting_wait_duration_ms, voting_start_time);

        assert_eq!(feed.get_name(), "TestFeed");

        let mut current_time_as_ms = get_ms_since_epoch();
        let mut msg_timestamp_as_ms = current_time_as_ms;

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
        let mut current_time_as_ms = current_system_time
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();

        // voting will start in 60 seconds
        let voting_start_time = current_system_time
            .checked_add(Duration::from_secs(60))
            .unwrap();

        // voting will be 30 seconds long
        let voting_wait_duration_ms = 30000;

        let oneshot_feed =
            FeedMetaData::new_oneshot("TestFeed", voting_wait_duration_ms, voting_start_time);
        let regular_feed =
            FeedMetaData::new("TestFeed", voting_wait_duration_ms, current_system_time);

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

    #[test]
    fn test_get_feed_id() {
        assert_eq!(super::get_feed_id("YahooFinance.DOGE/USDC"), Some(0));
        assert_eq!(super::get_feed_id("YahooFinance.BTC/USD"), Some(1));
        assert_eq!(super::get_feed_id("YahooFinance.ETH/USD"), Some(2));
        assert_eq!(super::get_feed_id("NonExistentName"), None);
    }

    #[test]
    fn chech_relevant_and_insert_mt() {
        const NTHREADS: u32 = 10;
        const DATA_FEED_ID: u32 = 1;

        let fmdr = Arc::new(RwLock::new(new_feeds_meta_data_reg_with_test_data()));
        let reports = Arc::new(RwLock::new(AllFeedsReports::new()));

        let mut children = vec![];

        for i in 0..NTHREADS {
            let fmdr = fmdr.clone();
            let reports = reports.clone();

            let msg_timestamp = get_ms_since_epoch();

            children.push(thread::spawn(move || {
                let feed = fmdr
                    .read()
                    .unwrap()
                    .get(0)
                    .expect("ID not present in registry");

                let current_time_as_ms = msg_timestamp + i as u128;

                assert!(
                    feed.read()
                        .unwrap()
                        .check_report_relevance(current_time_as_ms, msg_timestamp)
                        == ReportRelevance::Relevant
                );

                reports
                    .write()
                    .unwrap()
                    .push(DATA_FEED_ID, i.into(), FeedType::Numerical(0.1));

                println!("this is thread number {}", i);
            }));
        }

        for child in children {
            // Wait for the thread to finish. Returns a result.
            let _ = child.join();
        }

        let reports = reports.write().unwrap();
        let reports = reports
            .get(DATA_FEED_ID)
            .expect("ID not present in registry");
        let reports = reports.read().unwrap();
        // Process the reports:
        let mut values: Vec<&FeedType> = vec![];
        for kv in &reports.report {
            values.push(&kv.1);
        }
        assert!(values.len() as u32 == NTHREADS);
    }
}
