use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, SystemTime},
};

use crate::types::{DataFeedPayload, FeedMetaData, FeedType, Repeatability, Timestamp};
use blocksense_config::AllFeedsConfig;
use blocksense_utils::{time::current_unix_time, EncodedFeedId};
use chrono::{DateTime, TimeZone, Utc};
use ringbuf::{
    storage::Heap,
    traits::{Consumer, RingBuffer},
    HeapRb, SharedRb,
};
use serde::{ser::SerializeMap, Deserialize, Serialize, Serializer};
use std::time::UNIX_EPOCH;
use tokio::{sync::RwLock, time};
use tracing::{debug, info};

/// Map representing feed_id -> FeedMetaData
#[derive(Debug)]
pub struct FeedMetaDataRegistry {
    registered_feeds: HashMap<EncodedFeedId, Arc<RwLock<FeedMetaData>>>,
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
    pub fn push(&mut self, key: EncodedFeedId, fd: FeedMetaData) {
        self.registered_feeds.insert(key, Arc::new(RwLock::new(fd)));
    }
    pub fn get(&self, key: &EncodedFeedId) -> Option<Arc<RwLock<FeedMetaData>>> {
        self.registered_feeds.get(key).cloned()
    }
    pub fn get_keys(&self) -> Vec<EncodedFeedId> {
        self.registered_feeds.keys().copied().collect()
    }
    pub fn remove(&mut self, key: EncodedFeedId) {
        self.registered_feeds.remove(&key);
    }
}

pub fn new_feeds_meta_data_reg_with_test_data() -> FeedMetaDataRegistry {
    let start = SystemTime::now();
    let skip_publish_if_less_then_percentage = 0.0f32; // 0%
    let always_publish_heartbeat_ms = None;
    let fmd1 = FeedMetaData::new(
        "DOGE/USD".to_string(),
        60000,
        60.0f32, // 60%
        skip_publish_if_less_then_percentage,
        always_publish_heartbeat_ms,
        start,
        "numerical".to_string(),
        "average".to_string(),
        None,
    );
    let fmd2 = FeedMetaData::new(
        "BTS/USD".to_string(),
        30000,
        60.0f32, // 60%
        skip_publish_if_less_then_percentage,
        always_publish_heartbeat_ms,
        start,
        "numerical".to_string(),
        "average".to_string(),
        None,
    );
    let fmd3 = FeedMetaData::new(
        "ETH/USD".to_string(),
        60000,
        60.0f32, // 60%
        skip_publish_if_less_then_percentage,
        always_publish_heartbeat_ms,
        start,
        "numerical".to_string(),
        "average".to_string(),
        None,
    );

    let mut fmdr = FeedMetaDataRegistry::new();

    fmdr.push(EncodedFeedId::new(0, 0), fmd1);
    fmdr.push(EncodedFeedId::new(1, 0), fmd2);
    fmdr.push(EncodedFeedId::new(2, 0), fmd3);

    fmdr
}

pub fn new_feeds_meta_data_reg_from_config(conf: &AllFeedsConfig) -> FeedMetaDataRegistry {
    let mut fmdr = FeedMetaDataRegistry::new();

    for feed in &conf.feeds {
        fmdr.push(
            EncodedFeedId::new(feed.id, feed.stride),
            FeedMetaData::new(
                feed.full_name.clone(),
                feed.schedule.interval_ms,
                feed.quorum.percentage,
                feed.schedule.deviation_percentage,
                feed.schedule.heartbeat_ms,
                UNIX_EPOCH + Duration::from_millis(feed.schedule.first_report_start_unix_time_ms),
                feed.value_type.clone(),
                feed.quorum.aggregation.clone(),
                None, // Will be filled once FeedsSlotsManager is started and processors are up and running.
            ),
        );
    }

    fmdr
}

// For a given Feed this struct represents the received votes from different reporters.
#[derive(Debug)]
pub struct FeedReports {
    pub report: HashMap<u64, DataFeedPayload>,
}

impl FeedReports {
    pub fn clear(&mut self) {
        self.report.clear();
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct HistoryEntry {
    pub value: FeedType,
    pub update_number: u128,
    pub end_slot_timestamp: Timestamp,
}

impl HistoryEntry {
    pub fn get_date_time_published(&self) -> DateTime<Utc> {
        Utc.timestamp_opt(self.end_slot_timestamp as i64, 0)
            .unwrap()
    }
}

#[derive(Serialize)]
pub struct FeedAggregateHistory {
    #[serde(serialize_with = "serialize_aggregate_history")]
    pub aggregate_history: HashMap<EncodedFeedId, HeapRb<HistoryEntry>>,
}

fn serialize_aggregate_history<S>(
    aggregate_history: &HashMap<EncodedFeedId, HeapRb<HistoryEntry>>,
    s: S,
) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let mut encoded_feed_ids: Vec<&EncodedFeedId> = aggregate_history.keys().collect();
    encoded_feed_ids.sort();

    let mut serialize_map = s.serialize_map(Some(encoded_feed_ids.len()))?;
    for encoded_feed_id in encoded_feed_ids {
        let mut updates = vec![];
        let ring_buffer = &aggregate_history[encoded_feed_id];
        let (slice_a, slice_b) = ring_buffer.as_slices();
        for value in slice_a {
            updates.push(value);
        }
        for value in slice_b {
            updates.push(value);
        }
        serialize_map.serialize_key(&encoded_feed_id.data)?;
        serialize_map.serialize_value(&updates)?;
    }
    serialize_map.end()
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

    pub fn register_feed(&mut self, encoded_feed_id: EncodedFeedId, buf_size: usize) {
        let shared_rb = SharedRb::new(buf_size);

        self.aggregate_history.insert(encoded_feed_id, shared_rb);
    }

    pub fn deregister_feed(&mut self, encoded_feed_id: EncodedFeedId) {
        self.aggregate_history.remove(&encoded_feed_id);
    }

    pub fn is_registered_feed(&self, encoded_feed_id: EncodedFeedId) -> bool {
        self.aggregate_history.contains_key(&encoded_feed_id)
    }

    pub fn get(&self, encoded_feed_id: EncodedFeedId) -> Option<&SharedRb<Heap<HistoryEntry>>> {
        self.aggregate_history.get(&encoded_feed_id)
    }

    pub fn get_mut(&mut self, encoded_feed_id: EncodedFeedId) -> Option<&mut SharedRb<Heap<HistoryEntry>>> {
        self.aggregate_history.get_mut(&encoded_feed_id)
    }

    pub fn clear(&mut self, encoded_feed_id: EncodedFeedId) -> usize {
        match self.aggregate_history.get_mut(&encoded_feed_id) {
            Some(feed) => feed.clear(),
            _ => 0_usize,
        }
    }

    pub fn push_next(
        &mut self,
        encoded_feed_id: EncodedFeedId,
        aggregate_result: FeedType,
        end_slot_timestamp: Timestamp,
    ) {
        if let Some(ring_buffer) = self.aggregate_history.get_mut(&encoded_feed_id) {
            // Push the aggregate_result into the ring buffer
            let update_number = ring_buffer.last().map_or(0, |x| x.update_number + 1);
            ring_buffer.push_overwrite(HistoryEntry {
                value: aggregate_result,
                update_number,
                end_slot_timestamp,
            });
        } else {
            info!(
                "Feed Id: {}, not registered in FeedAggregateHistory!",
                encoded_feed_id
            );
        }
    }

    pub fn last(&self, encoded_feed_id: EncodedFeedId) -> Option<&HistoryEntry> {
        if let Some(ring_buffer) = self.aggregate_history.get(&encoded_feed_id) {
            ring_buffer.last()
        } else {
            info!(
                "Feed Id: {}, not registered in FeedAggregateHistory!",
                encoded_feed_id
            );
            None
        }
    }

    pub fn last_value(&self, encoded_feed_id: EncodedFeedId) -> Option<&FeedType> {
        self.last(encoded_feed_id).map(|h| &h.value)
    }
}

// This struct holds all the Feeds by ID (the key in the map) and the received votes for them
#[derive(Debug)]
pub struct AllFeedsReports {
    reports: HashMap<EncodedFeedId, Arc<RwLock<FeedReports>>>,
}

impl Default for AllFeedsReports {
    fn default() -> Self {
        Self::new()
    }
}

pub enum VoteStatus {
    FirstVoteForSlot,
    RevoteForSlot(Box<DataFeedPayload>),
}

impl AllFeedsReports {
    pub fn new() -> AllFeedsReports {
        AllFeedsReports {
            reports: HashMap::new(),
        }
    }
    pub async fn push(
        &mut self,
        encoded_feed_id: EncodedFeedId,
        reporter_id: u64,
        data: DataFeedPayload,
    ) -> VoteStatus {
        let res = self.reports.entry(encoded_feed_id).or_insert_with(|| {
            Arc::new(RwLock::new(FeedReports {
                report: HashMap::new(),
            }))
        }); //TODO: Reject votes for unregistered feed ID-s
        let mut res = res.write().await;

        match res.report.insert(reporter_id, data) {
            Some(old_value) => VoteStatus::RevoteForSlot(Box::new(old_value)),
            None => VoteStatus::FirstVoteForSlot,
        }
    }
    pub fn get(&self, encoded_feed_id: EncodedFeedId) -> Option<Arc<RwLock<FeedReports>>> {
        self.reports.get(&encoded_feed_id).cloned()
    }
}

pub struct SlotTimeTracker {
    name: String,
    slot_interval: Duration,
    start_time_ms: u128,
}

impl SlotTimeTracker {
    pub fn new(name: String, slot_interval: Duration, start_time_ms: u128) -> SlotTimeTracker {
        SlotTimeTracker {
            name,
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
        // These log lines indicate the successful completion of a slot, as well as the successful
        // start of the next slot. At the time of writing, there is one tracker per feed, as well
        // as a single tracker for block generation.
        debug!("Awaiting end of slot... [{}]", self.name);
        await_time(time_to_await_ms).await;
        debug!("New slot begins [{}]", self.name);
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

        debug!(
            "[stt_name={}] current_time_as_ms      = {}",
            self.name, current_time_as_ms
        );
        debug!(
            "[stt_name={}] slots_count             = {}",
            self.name, slot_number
        );
        debug!(
            "[stt_name={}] current_slot_start_time = {}",
            self.name, current_slot_start_time
        );
        debug!(
            "[stt_name={}] current_slot_end_time   = {}",
            self.name, current_slot_end_time
        );
        debug!(
            "[stt_name={}] uncorrected sleep time  = {}",
            self.name,
            current_time_as_ms + self.slot_interval.as_millis()
        );
        debug!(
            "[stt_name={}] diff                    = {}",
            self.name,
            current_time_as_ms + self.slot_interval.as_millis() - current_slot_end_time
        );

        result_ms
    }

    pub fn reset_report_start_time(&mut self) {
        self.start_time_ms = current_unix_time();
    }

    pub fn get_last_slot(&self) -> u128 {
        (current_unix_time() - self.start_time_ms) / self.slot_interval.as_millis()
    }
}

pub async fn await_time(time_to_await_ms: u64) {
    let time_to_await: Duration = Duration::from_millis(time_to_await_ms);
    let mut interval = time::interval(time_to_await);
    interval.tick().await;
    // The first tick completes immediately.
    interval.tick().await;
}

#[cfg(test)]
mod tests {
    use blocksense_utils::time::current_unix_time;
    use blocksense_utils::EncodedFeedId;
    use blocksense_utils::FeedId;

    use crate::registry::new_feeds_meta_data_reg_with_test_data;
    use crate::registry::AllFeedsReports;
    use crate::registry::SlotTimeTracker;
    use crate::types::test_payload_from_result;
    use crate::types::FeedMetaData;
    use crate::types::FeedResult;
    use crate::types::FeedType;
    use crate::types::Repeatability;
    use crate::types::ReportRelevance;
    use std::sync::Arc;
    use std::time::Instant;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use tokio::sync::RwLock;

    #[tokio::test]
    async fn basic_test() {
        let fmdr = new_feeds_meta_data_reg_with_test_data();

        let mut expected_keys_vec = vec![EncodedFeedId::new(0, 0), EncodedFeedId::new(1, 0), EncodedFeedId::new(2, 0)];
        let mut actual_keys_vec = fmdr.get_keys().clone();

        expected_keys_vec.sort();
        actual_keys_vec.sort();
        assert_eq!(actual_keys_vec, expected_keys_vec);

        let mut current_time_as_ms = current_unix_time();

        println!("fmdr.get_keys()={fmdr:?}");
        assert!(
            fmdr.get(&EncodedFeedId::new(0, 0))
                .expect("ID not present in registry")
                .read()
                .await
                .get_slot(current_time_as_ms)
                == 0
        );
        assert!(
            fmdr.get(&EncodedFeedId::new(1, 0))
                .expect("ID not present in registry")
                .read()
                .await
                .get_slot(current_time_as_ms)
                == 0
        );

        assert!(
            fmdr.get(&EncodedFeedId::new(0, 0)).expect("ID not present in registry").read().await.get_report_interval_ms() as u128 ==
            fmdr.get(&EncodedFeedId::new(1, 0)).expect("ID not present in registry").read().await.get_report_interval_ms() as u128 * 2,
            "The test expects that Feed ID 0 has twice longer report interval compared to Feed ID 1"
        );

        current_time_as_ms += fmdr
            .get(&EncodedFeedId::new(1, 0))
            .expect("ID not present in registry")
            .read()
            .await
            .get_report_interval_ms() as u128
            + 1u128;
        assert!(
            fmdr.get(&EncodedFeedId::new(0, 0))
                .expect("ID not present in registry")
                .read()
                .await
                .get_slot(current_time_as_ms)
                == 0
        );
        assert!(
            fmdr.get(&EncodedFeedId::new(1, 0))
                .expect("ID not present in registry")
                .read()
                .await
                .get_slot(current_time_as_ms)
                == 1
        );
        current_time_as_ms += fmdr
            .get(&EncodedFeedId::new(1, 0))
            .expect("ID not present in registry")
            .read()
            .await
            .get_report_interval_ms() as u128
            + 1u128;

        assert!(
            fmdr.get(&EncodedFeedId::new(0, 0))
                .expect("ID not present in registry")
                .read()
                .await
                .get_slot(current_time_as_ms)
                == 1
        );
        assert!(
            fmdr.get(&EncodedFeedId::new(1, 0))
                .expect("ID not present in registry")
                .read()
                .await
                .get_slot(current_time_as_ms)
                == 2
        );
    }

    #[tokio::test]
    async fn relevant_feed_check() {
        const DATA_FEED_ID: FeedId = 1;

        let fmdr = new_feeds_meta_data_reg_with_test_data();

        let mut current_time_as_ms = current_unix_time();

        let mut msg_timestamp = current_time_as_ms;

        let feed = fmdr.get(&EncodedFeedId::new(DATA_FEED_ID, 0)).expect("ID not present in registry");

        println!("fmdr.get_keys()={fmdr:?}");
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
            10.0f32, // 10%
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
        let always_publish_heartbeat_ms = None;

        let oneshot_feed = FeedMetaData::new_oneshot(
            "TestFeed".to_string(),
            voting_wait_duration_ms,
            10.0f32, // 10%
            voting_start_time,
        );
        let regular_feed = FeedMetaData::new(
            "TestFeed".to_string(),
            voting_wait_duration_ms,
            10.0f32, // 10%
            1.0f32,  // 1%
            always_publish_heartbeat_ms,
            current_system_time,
            "numeric".to_string(),
            "average".to_string(),
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
        const DATA_FEED_ID: FeedId = 1;

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
                    .get(&EncodedFeedId::new(0, 0))
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
                        EncodedFeedId::new(DATA_FEED_ID, 0),
                        i.into(),
                        test_payload_from_result(Ok(FeedType::Numerical(0.1))),
                    )
                    .await;

                println!("this is thread number {i}");
            }));
        }

        let _ = futures::future::join_all(children).await;

        let reports = reports.write().await;
        let reports = reports
            .get(EncodedFeedId::new(DATA_FEED_ID, 0))
            .expect("ID not present in registry");
        let reports = reports.read().await;
        // Process the reports:
        let mut values: Vec<&FeedResult> = vec![];
        for kv in &reports.report {
            values.push(&kv.1.result);
        }
        assert!(values.len() as u32 == NTHREADS);
    }

    #[tokio::test]
    async fn test_await_end_of_current_slot() {
        // setup
        const SLOT_INTERVAL: Duration = Duration::from_secs(1);
        const START_TIME_MS: u128 = 0;
        let time_tracker = SlotTimeTracker::new(
            "test_await_end_of_current_slot".to_string(),
            SLOT_INTERVAL,
            START_TIME_MS,
        );

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

    // #[tokio::test]
    // async fn test_get_duration_until_end_of_current_slot_periodic() {
    //     // setup
    //     const SLOT_INTERVAL: Duration = Duration::from_secs(1);
    //     const START_TIME_MS: u128 = 0;
    //     let mut time_tracker = SlotTimeTracker::new(
    //         "test_get_duration_until_end_of_current_slot_periodic".to_string(),
    //         SLOT_INTERVAL,
    //         START_TIME_MS,
    //     );

    //     // run
    //     let duration_ms =
    //         time_tracker.get_duration_until_end_of_current_slot(&Repeatability::Periodic);
    //     // assert
    //     assert!(duration_ms < SLOT_INTERVAL.as_millis() as i128);

    //     // setup
    //     time_tracker.reset_report_start_time();
    //     let duration_ms =
    //         time_tracker.get_duration_until_end_of_current_slot(&Repeatability::Periodic);
    //     // assert
    //     // Should be ideally exactly SLOT_INTERVAL ms, but we cannot count on exactness
    //     assert!(duration_ms > (SLOT_INTERVAL.as_millis() as i128 - 100));
    //     assert!(duration_ms < (SLOT_INTERVAL.as_millis() as i128 + 100));
    // }

    #[tokio::test]
    async fn test_get_duration_until_end_of_current_slot_oneshot() {
        // setup
        let slot_interval: Duration = Duration::from_secs(3);
        let start_time_ms: u128 = current_unix_time() + 6000;
        let time_tracker = SlotTimeTracker::new(
            "test_get_duration_until_end_of_current_slot_oneshot".to_string(),
            slot_interval,
            start_time_ms,
        );

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
