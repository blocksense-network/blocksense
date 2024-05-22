use crate::feeds::average_feed_processor::AverageFeedProcessor;
use crate::feeds::feeds_processing::FeedProcessing;
use crate::utils::time_utils::get_ms_since_epoch;
use actix_web::rt::time;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::time::Duration;
use tracing::{debug, trace};

#[derive(Debug)]
pub struct FeedMetaData {
    name: String,
    report_interval_ms: u64, // Consider oneshot feeds.
    first_report_start_time: SystemTime,
    feed_type: Box<dyn FeedProcessing>,
}

impl FeedMetaData {
    pub fn new(
        n: &str,
        r: u64, // Consider oneshot feeds.
        f: SystemTime,
    ) -> FeedMetaData {
        FeedMetaData {
            name: n.to_string(),
            report_interval_ms: r,
            first_report_start_time: f,
            feed_type: Box::new(AverageFeedProcessor::new()),
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
        ((current_time_as_ms - self.get_first_report_start_time_ms())
            / self.report_interval_ms as u128) as u64
    }
    pub fn get_feed_type(&self) -> &dyn FeedProcessing {
        self.feed_type.as_ref()
    }
    pub fn check_report_relevance(&self, current_time_as_ms: u128, msg_timestamp: u128) -> bool {
        let start_of_voting_round = self.get_first_report_start_time_ms()
            + (self.get_slot(current_time_as_ms) as u128 * self.get_report_interval_ms() as u128);
        let end_of_voting_round = start_of_voting_round + self.get_report_interval_ms() as u128;

        if current_time_as_ms >= start_of_voting_round
            && current_time_as_ms <= end_of_voting_round
            && msg_timestamp >= start_of_voting_round
            && msg_timestamp <= end_of_voting_round
        {
            debug!("accepted!");
            return true;
        } else {
            debug!("rejected!");
            return false;
        }
    }
}

pub struct FeedSlotTimeTracker {
    report_interval_ms: u64, // Consider oneshot feeds.
    first_report_start_time_ms: u128,
}

impl FeedSlotTimeTracker {
    pub fn new(
        r: u64, // Consider oneshot feeds.
        f: u128,
    ) -> FeedSlotTimeTracker {
        FeedSlotTimeTracker {
            report_interval_ms: r,
            first_report_start_time_ms: f,
        }
    }
    pub async fn await_end_of_current_slot(&self) {
        let current_time_as_ms = get_ms_since_epoch();
        let slots_count = (current_time_as_ms - self.first_report_start_time_ms)
            / self.report_interval_ms as u128;
        let current_slot_start_time =
            self.first_report_start_time_ms + slots_count * self.report_interval_ms as u128;
        let current_slot_end_time = current_slot_start_time + self.report_interval_ms as u128;

        trace!("current_time_as_ms      = {}", current_time_as_ms);
        trace!("slots_count             = {}", slots_count);
        trace!("current_slot_start_time = {}", current_slot_start_time);
        trace!("current_slot_end_time   = {}", current_slot_end_time);
        trace!(
            "uncorrected sleep time  = {}",
            current_time_as_ms + self.report_interval_ms as u128
        );
        trace!(
            "diff                    = {}",
            current_time_as_ms + self.report_interval_ms as u128 - current_slot_end_time
        );

        let mut interval = time::interval(Duration::from_millis(
            (current_slot_end_time - current_time_as_ms) as u64,
        ));
        interval.tick().await; // The first tick completes immediately.
        interval.tick().await;
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

    let fmd1 = FeedMetaData::new("DOGE/USD", 20000, start);
    let fmd2 = FeedMetaData::new("BTS/USD", 10000, start);
    let fmd3 = FeedMetaData::new("ETH/USD", 20000, start);

    let mut fmdr = FeedMetaDataRegistry::new();

    fmdr.push(0, fmd1);
    fmdr.push(1, fmd2);
    fmdr.push(2, fmd3);

    fmdr
}

// For a given Feed this struct represents the received votes from different reporters.
#[derive(Debug)]
pub struct FeedReports {
    pub report: HashMap<u64, String>,
}

impl FeedReports {
    pub fn clear(&mut self) {
        self.report.clear();
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
    pub fn push(&mut self, feed_id: u32, reporter_id: u64, data: String) {
        let res = self.reports.entry(feed_id).or_insert_with(|| {
            Arc::new(RwLock::new(FeedReports {
                report: HashMap::new(),
            }))
        }); //TODO: Reject votes for unregistered feed ID-s
        let mut res: std::sync::RwLockWriteGuard<'_, FeedReports> = res.write().unwrap();
        if !res.report.contains_key(&reporter_id) {
            // Stick to first vote from a reporter.
            res.report.insert(reporter_id, data);
        }
    }
    pub fn get(&self, feed_id: u32) -> Option<Arc<RwLock<FeedReports>>> {
        self.reports.get(&feed_id).cloned()
    }
}

pub fn get_feed_id(name: &str) -> u32 {
    if name.contains("YahooFinance.BTC/USD") {
        return 1;
    } else if name.contains("YahooFinance.ETH/USD") {
        return 2;
    }
    0 // TODO: get from registry
}

pub fn get_reporters_for_feed_id_slot(feed_id: u32, slot: u64) -> Vec<u32> {
    (0..10).collect()
    // TODO: this will be a subset of the reporters that have been assigned
    // to vote for this feed for the given sequence id.
    // Initially we will have all reporters vote for all feeds.
}

#[cfg(test)]
mod tests {
    use crate::feeds::feeds_registry::{
        new_feeds_meta_data_reg_with_test_data, AllFeedsReports, FeedMetaDataRegistry,
    };
    use crate::utils::time_utils::get_ms_since_epoch;
    use std::sync::Arc;
    use std::sync::RwLock;
    use std::thread;
    use std::time::SystemTime;
    use std::time::UNIX_EPOCH;

    #[test]
    fn basic_test() {
        let fmdr = new_feeds_meta_data_reg_with_test_data();

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
                == true
        );

        current_time_as_ms += 11 * 1000; // Advance time, the report will become obsolete

        assert!(
            feed.read()
                .unwrap()
                .check_report_relevance(current_time_as_ms, msg_timestamp)
                == false
        );

        msg_timestamp += 11 * 1000; // Advance report time to make it relevant

        assert!(
            feed.read()
                .unwrap()
                .check_report_relevance(current_time_as_ms, msg_timestamp)
                == true
        );
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
                        == true
                );

                reports.write().unwrap().push(
                    DATA_FEED_ID,
                    i.into(),
                    "0123456789abcdef".to_string(),
                );

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
        let mut values: Vec<&String> = vec![];
        for kv in &reports.report {
            values.push(&kv.1);
        }
        assert!(values.len() as u32 == NTHREADS);
    }
}
