//    id: u64,
use std::collections::hash_map::Keys;
use std::collections::HashMap;
use std::rc::Rc;

pub struct FeedMetaData {
    name: String,
    report_interval: u64, // Consider oneshot feeds.
    last_update_to_contract: u64,
    slot: u64,
}

impl FeedMetaData {
    pub fn new(
        n: &str,
        r: u64, // Consider oneshot feeds.
        l: u64,
        s: u64,
    ) -> FeedMetaData {
        FeedMetaData {
            name: n.to_string(),
            report_interval: r,
            last_update_to_contract: l,
            slot: s,
        }
    }
    pub fn get_name(&self) -> &String {
        &self.name
    }
    pub fn get_report_interval(&self) -> u64 {
        self.report_interval
    }
    pub fn get_last_update_to_contract(&mut self) -> u64 {
        self.last_update_to_contract
    }
    pub fn set_last_update_to_contract(&mut self, report_time: u64) {
        assert!(self.last_update_to_contract < report_time);
        self.last_update_to_contract = report_time;
    }
    pub fn get_slot(&self) -> u64 {
        self.slot
    }
    pub fn inc_slot(&mut self) {
        self.slot += 1;
    }
}

// map representing feed_id -> FeedMetaData
#[derive(Debug)]
pub struct FeedMetaDataRegistry {
    registered_feeds: HashMap<u64, Rc<RefCell<FeedMetaData>>>,
}

impl FeedMetaDataRegistry {
    pub fn new() -> FeedMetaDataRegistry {
        FeedMetaDataRegistry {
            registered_feeds: HashMap::new()
        }
    }
    pub fn push(&mut self, id: u64, fd: FeedMetaData) {
        self.registered_feeds.insert(id, Rc::new(RefCell::new(fd)));
    }
    pub fn get(&mut self, id: u64) -> Rc<RefCell<FeedMetaData>> {
        self.registered_feeds
            .get_key_value(&id)
            .expect("Feed ID not registered")
            .1.clone()
    }
    pub fn get_keys(&mut self) -> Keys<u64, Rc<RefCell<FeedMetaData>>> {
        self.registered_feeds.keys()
    }
}

// For a given Feed this struct represents the received votes from different reporters.
struct FeedReports {
    report: HashMap<u64, String>,
}

// This struct holds all the Feeds by ID (the key in the map) and the received votes for them
pub struct AllFeedsReports {
    reports: HashMap<u64, FeedReports>,
}

impl AllFeedsReports {
    pub fn push(&mut self, feed_id: u64, reporter_id: u64, data: String) {
        let res = self.reports.entry(feed_id).or_insert_with(|| FeedReports {
            report: HashMap::new(),
        });
        res.report.insert(reporter_id, data);
    }
}
