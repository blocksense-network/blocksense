use crate::feeds::average_feed_processor::AverageFeedProcessor;
use crate::feeds::feeds_processing::FeedProcessing;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::debug;

#[derive(Debug)]
pub struct FeedMetaData {
    name: String,
    report_interval_ms: u64, // Consider oneshot feeds.
    first_report_start_time: SystemTime,
    feed_type: Box<dyn FeedProcessing>,
}

#[derive(PartialEq)]
pub enum ReportRelevance {
    Relevant,
    NonRelevantOld,
    NonRelevantInFuture,
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
    pub fn check_report_relevance(
        &self,
        current_time_as_ms: u128,
        msg_timestamp: u128,
    ) -> ReportRelevance {
        let start_of_voting_round = self.get_first_report_start_time_ms()
            + (self.get_slot(current_time_as_ms) as u128 * self.get_report_interval_ms() as u128);
        let end_of_voting_round = start_of_voting_round + self.get_report_interval_ms() as u128;

        if msg_timestamp < start_of_voting_round {
            debug!("Rejected report, time stamp is in a past slot!");
            return ReportRelevance::NonRelevantOld;
        }
        if msg_timestamp > end_of_voting_round {
            debug!("Rejected report, time stamp is in a future slot!");
            return ReportRelevance::NonRelevantInFuture;
        }
        debug!("Accepted report!");
        ReportRelevance::Relevant
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
    pub fn push(&mut self, feed_id: u32, reporter_id: u64, data: String) -> bool {
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

pub fn get_reporters_for_feed_id_slot(_feed_id: u32, _slot: u64) -> Vec<u32> {
    (0..10).collect()
    // TODO: this will be a subset of the reporters that have been assigned
    // to vote for this feed for the given sequence id.
    // Initially we will have all reporters vote for all feeds.
}

#[cfg(test)]
mod tests {
    use crate::feeds::feeds_registry::{
        new_feeds_meta_data_reg_with_test_data, AllFeedsReports, ReportRelevance,
    };
    use crate::utils::time_utils::get_ms_since_epoch;
    use std::sync::Arc;
    use std::sync::RwLock;
    use std::thread;

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
