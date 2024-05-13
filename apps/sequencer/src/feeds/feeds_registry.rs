use crate::feeds::average_feed_processor::AverageFeedProcessor;
use crate::feeds::feeds_processing::FeedProcessing;
use std::collections::hash_map::Keys;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug)]
pub struct FeedMetaData {
    name: String,
    report_interval: u64, // Consider oneshot feeds.
    first_report_start_time: SystemTime,
    slot: u64,
    feed_type: Box<dyn FeedProcessing>,
}

impl FeedMetaData {
    pub fn new(
        n: &str,
        r: u64, // Consider oneshot feeds.
        f: SystemTime,
        s: u64,
    ) -> FeedMetaData {
        FeedMetaData {
            name: n.to_string(),
            report_interval: r,
            first_report_start_time: f,
            slot: s,
            feed_type: Box::new(AverageFeedProcessor::new()),
        }
    }
    pub fn get_name(&self) -> &String {
        &self.name
    }
    pub fn get_report_interval(&self) -> u64 {
        self.report_interval
    }
    pub fn get_first_report_start_time_ms(&self) -> u128 {
        let since_the_epoch = self
            .first_report_start_time
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards");
        since_the_epoch.as_millis()
    }
    pub fn get_slot(&self) -> u64 {
        self.slot
    }
    pub fn inc_slot(&mut self) {
        self.slot += 1;
    }
    pub fn get_feed_type(&self) -> &dyn FeedProcessing {
        self.feed_type.as_ref()
    }
    pub fn check_report_relevance(&self, current_time_as_ms: u128, msg_timestamp: u128) -> bool {
        let start_of_voting_round = self.get_first_report_start_time_ms()
            + (self.get_slot() as u128 * self.get_report_interval() as u128);
        let end_of_voting_round = self.get_first_report_start_time_ms()
            + ((self.get_slot() + 1) as u128 * self.get_report_interval() as u128);

        if current_time_as_ms >= start_of_voting_round
            && current_time_as_ms <= end_of_voting_round
            && msg_timestamp >= start_of_voting_round
            && msg_timestamp <= end_of_voting_round
        {
            println!("accepted!");
            return true;
        } else {
            println!("rejected!");
            return false;
        }
    }
}

// map representing feed_id -> FeedMetaData
#[derive(Debug)]
pub struct FeedMetaDataRegistry {
    registered_feeds: HashMap<u64, Arc<RwLock<FeedMetaData>>>,
}

impl FeedMetaDataRegistry {
    pub fn new() -> FeedMetaDataRegistry {
        FeedMetaDataRegistry {
            registered_feeds: HashMap::new(),
        }
    }
    pub fn push(&mut self, id: u64, fd: FeedMetaData) {
        self.registered_feeds.insert(id, Arc::new(RwLock::new(fd)));
    }
    pub fn get(&self, id: u64) -> Option<Arc<RwLock<FeedMetaData>>> {
        self.registered_feeds.get(&id).cloned()
    }
    pub fn get_keys(&self) -> Vec<u64> {
        self.registered_feeds.keys().copied().collect()
    }
}

pub fn new_feeds_meta_data_reg_with_test_data() -> FeedMetaDataRegistry {
    let start = SystemTime::now();

    let fmd1 = FeedMetaData::new("DOGE/USD", 20000, start, 0);
    let fmd2 = FeedMetaData::new("BTS/USD", 10000, start, 0);
    let fmd3 = FeedMetaData::new("ETH/USD", 20000, start, 0);

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
    reports: HashMap<u64, Arc<RwLock<FeedReports>>>,
}

impl AllFeedsReports {
    pub fn new() -> AllFeedsReports {
        AllFeedsReports {
            reports: HashMap::new(),
        }
    }
    pub fn push(&mut self, feed_id: u64, reporter_id: u64, data: String) {
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
    pub fn get(&self, feed_id: u64) -> Option<Arc<RwLock<FeedReports>>> {
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
    use std::sync::Arc;
    use std::sync::RwLock;
    use std::thread;
    use std::time::SystemTime;
    use std::time::UNIX_EPOCH;

    #[test]
    fn basic_test() {
        let fmdr = new_feeds_meta_data_reg_with_test_data();

        println!("fmdr.get_keys()={:?}", fmdr);
        fmdr.get(0)
            .expect("ID not present in registry")
            .write()
            .unwrap()
            .inc_slot();
        println!("fmdr.get_keys()={:?}", fmdr);
        fmdr.get(1)
            .expect("ID not present in registry")
            .write()
            .unwrap()
            .inc_slot();
        fmdr.get(1)
            .expect("ID not present in registry")
            .write()
            .unwrap()
            .inc_slot();
        fmdr.get(1)
            .expect("ID not present in registry")
            .write()
            .unwrap()
            .inc_slot();
        assert!(
            fmdr.get(0)
                .expect("ID not present in registry")
                .read()
                .unwrap()
                .get_slot()
                == 1
        );
        assert!(
            fmdr.get(1)
                .expect("ID not present in registry")
                .read()
                .unwrap()
                .get_slot()
                == 3
        );
    }

    #[test]
    fn relevant_feed_check() {
        const DATA_FEED_ID: u64 = 1;

        let fmdr = new_feeds_meta_data_reg_with_test_data();

        let mut current_time_as_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_millis();

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

        msg_timestamp += 11 * 1000; // Advance report time. It will still be obsolete, because we have not
                                    // incremented the slot.

        assert!(
            feed.read()
                .unwrap()
                .check_report_relevance(current_time_as_ms, msg_timestamp)
                == false
        );

        feed.write().unwrap().inc_slot(); // Increment the slot, the report will now be in the corect time frame of the new slot.

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
        const DATA_FEED_ID: u64 = 1;

        let fmdr = Arc::new(RwLock::new(new_feeds_meta_data_reg_with_test_data()));
        let reports = Arc::new(RwLock::new(AllFeedsReports::new()));

        let mut children = vec![];

        for i in 0..NTHREADS {
            let fmdr = fmdr.clone();
            let reports = reports.clone();

            let msg_timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("Time went backwards")
                .as_millis();

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
