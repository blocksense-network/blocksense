use crate::utils::byte_utils::to_hex_string;
use std::collections::hash_map::Keys;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

pub trait FeedProcessing: Send + Sync {
    fn process(&self, values: Vec<&String>) -> String;
}

#[derive(Debug)]
struct AverageFeedProcessor {}

impl AverageFeedProcessor {
    pub fn new() -> AverageFeedProcessor {
        AverageFeedProcessor {}
    }
}
use alloy::hex;
impl FeedProcessing for AverageFeedProcessor {
    fn process(&self, values: Vec<&String>) -> String {
        let num_elements = values.len() as f64;
        for v in &values {
            println!("{}", v);
        }
        let total: f64 = values
            .into_iter()
            .map(|v| f64::from_be_bytes(hex::decode(v).unwrap()[0..8].try_into().unwrap()))
            .sum();
        let result: f64 = total / num_elements;

        to_hex_string(result.to_be_bytes().to_vec())
    }
}

use core::fmt::Debug;
impl Debug for dyn FeedProcessing {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "FeedProcessing")
    }
}

#[derive(Debug)]
pub struct FeedMetaData {
    name: String,
    report_interval: u64, // Consider oneshot feeds.
    first_report_start_time: u128,
    slot: u64,
    feed_type: Box<dyn FeedProcessing>,
}

impl FeedMetaData {
    pub fn new(
        n: &str,
        r: u64, // Consider oneshot feeds.
        f: u128,
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
    pub fn get_first_report_start_time(&self) -> u128 {
        self.first_report_start_time
    }
    pub fn get_slot(&self) -> u64 {
        self.slot
    }
    pub fn inc_slot(&mut self) {
        self.slot += 1;
    }
    pub fn get_feed_type(&self) -> &Box<dyn FeedProcessing> {
        &self.feed_type
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
    pub fn new_with_test_data() -> FeedMetaDataRegistry {
        let start = SystemTime::now();
        let since_the_epoch = start
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards");

        let fmd1 = FeedMetaData::new("BTS/USD", 10000, since_the_epoch.as_millis(), 0);
        let fmd2 = FeedMetaData::new("ETH/USD", 20000, since_the_epoch.as_millis(), 0);

        let mut fmdr = FeedMetaDataRegistry::new();

        fmdr.push(0, fmd1);
        fmdr.push(1, fmd2);

        fmdr
    }
    pub fn push(&mut self, id: u64, fd: FeedMetaData) {
        self.registered_feeds.insert(id, Arc::new(RwLock::new(fd)));
    }
    pub fn get(&self, id: u64) -> Option<Arc<RwLock<FeedMetaData>>> {
        self.registered_feeds.get(&id).cloned()
    }
    pub fn get_keys(&self) -> Keys<u64, Arc<RwLock<FeedMetaData>>> {
        self.registered_feeds.keys()
    }
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
    use crate::feeds::feeds_registry::FeedMetaData;
    use crate::feeds::feeds_registry::FeedMetaDataRegistry;

    #[test]
    fn basic_test() {
        let mut fmdr = FeedMetaDataRegistry::new_with_test_data();

        println!("fmdr.get_keys()={:?}", fmdr);
        fmdr.get(0).write().unwrap().inc_slot();
        assert!(fmdr.get(0).read().unwrap().get_slot() == 1);
        println!("fmdr.get_keys()={:?}", fmdr);
        fmdr.get(1).write().unwrap().inc_slot();
        fmdr.get(1).write().unwrap().inc_slot();
        fmdr.get(1).write().unwrap().inc_slot();
        assert!(fmdr.get(0).read().unwrap().get_slot() == 1);
        assert!(fmdr.get(1).read().unwrap().get_slot() == 3);
    }
}
