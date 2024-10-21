use crate::reporters::reporter::SharedReporters;
use anomaly_detection::ingest::anomaly_detector_aggregate;
use data_feeds::feeds_processing::naive_packing;
use eyre::Result;
use feed_registry::registry::FeedAggregateHistory;
use feed_registry::registry::{AllFeedsReports, SlotTimeTracker};
use feed_registry::types::FeedResult;
use feed_registry::types::FeedType;
use feed_registry::types::{FeedMetaData, Repeatability};
use prometheus::{inc_metric, metrics::FeedsMetrics};
use ringbuf::traits::consumer::Consumer;
use std::fmt::Debug;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc::UnboundedSender, RwLock};
use tracing::error;
use tracing::warn;
use tracing::{debug, info};
use utils::time::current_unix_time;
use utils::to_hex_string;

use super::feeds_slots_manager::ProcessorResultValue;

const AD_MIN_DATA_POINTS_THRESHOLD: usize = 100;

pub struct FeedSlotsProcessor {
    name: String,
    key: u32,
}

impl FeedSlotsProcessor {
    pub fn new(name: String, key: u32) -> FeedSlotsProcessor {
        FeedSlotsProcessor { name, key }
    }

    pub async fn start_loop<
        K: Debug + Clone + std::string::ToString + 'static + std::convert::From<std::string::String>,
        V: Debug + Clone + std::string::ToString + 'static + std::convert::From<std::string::String>,
    >(
        &self,
        result_send: UnboundedSender<(K, V)>,
        feed: Arc<RwLock<FeedMetaData>>,
        reports: Arc<RwLock<AllFeedsReports>>,
        history: Arc<RwLock<FeedAggregateHistory>>,
        reporters: SharedReporters,
        feed_metrics: Option<Arc<RwLock<FeedsMetrics>>>,
    ) -> Result<ProcessorResultValue> {
        let (is_oneshot, report_interval_ms, first_report_start_time, quorum_percentage) = {
            let datafeed = feed.read().await;
            (
                datafeed.is_oneshot(),
                datafeed.get_report_interval_ms(),
                datafeed.get_first_report_start_time_ms(),
                datafeed.get_quorum_percentage(),
            )
        };

        let feed_slots_time_tracker = SlotTimeTracker::new(
            Duration::from_millis(report_interval_ms),
            first_report_start_time,
        );

        let mut is_processed = false;
        let repeatability = if is_oneshot {
            Repeatability::Oneshot
        } else {
            Repeatability::Periodic
        };

        loop {
            if is_oneshot && is_processed {
                return Ok(ProcessorResultValue::ProcessorExitStatus(String::from(
                    "Oneshot feed processed",
                )));
            }
            feed_slots_time_tracker
                .await_end_of_current_slot(&repeatability)
                .await;
            is_processed = true;

            let result_post_to_contract: FeedType; //TODO(snikolov): This needs to be enforced as Bytes32
            let key_post: u32;
            let mut is_quorum_reached = true;

            {
                let current_time_as_ms = current_unix_time();

                let slot = feed.read().await.get_slot(current_time_as_ms);

                info!(
                    "Processing votes for {} with id {} for slot {} rep_interval {}.",
                    self.name, self.key, slot, report_interval_ms
                );

                let reports: Arc<RwLock<feed_registry::registry::FeedReports>> =
                    match reports.read().await.get(self.key) {
                        Some(x) => x,
                        None => {
                            info!("No reports found!");
                            continue;
                        }
                    };
                debug!("found the following reports:");
                debug!("reports = {:?}", reports);

                let mut reports = reports.write().await;
                // Process the reports:
                let mut values: Vec<&FeedType> = vec![];
                for kv in &reports.report {
                    match kv.1 {
                        FeedResult::Result { result } => values.push(result),
                        FeedResult::Error { .. } => {
                            warn!(
                                "Got error from reporter {} for feed id {} slot {}",
                                kv.0, self.key, slot
                            );
                        }
                    }
                }

                if values.is_empty() {
                    info!("No reports found for feed: {} slot: {}!", self.name, &slot);
                    continue;
                }

                let total_votes_count = values.len() as f32;
                let required_votes_count = quorum_percentage * reporters.read().await.len() as f32;

                if total_votes_count < required_votes_count {
                    warn!(
                    "Insufficient quorum of reports to post to contract for feed: {} slot: {}! Expected at least a quorum of {}, but received {} out of {} valid votes.",
                    self.name, &slot, quorum_percentage, total_votes_count, reporters.read().await.len()
                );
                    is_quorum_reached = false;
                }

                key_post = self.key;
                if let Some(feed_metrics) = &feed_metrics {
                    if is_quorum_reached {
                        inc_metric!(feed_metrics, key_post, quorums_reached);
                    } else {
                        inc_metric!(feed_metrics, key_post, failures_to_reach_quorum);
                    }
                }

                result_post_to_contract = feed.read().await.get_feed_aggregator().aggregate(values); // Dispatch to concrete FeedAggregate implementation.

                // Oneshot feeds have no history, so we cannot perform anomaly detection on them.
                if !is_oneshot {
                    {
                        let mut history_guard = history.write().await;
                        history_guard.push(self.key, result_post_to_contract.clone())
                    }

                    let history_lock = history.read().await;

                    // The first slice is from the current read position to the end of the array
                    // The second slice represents the segment from the start of the array up to the current write position if the buffer has wrapped around
                    let (first, last) = history_lock
                        .collect(self.key)
                        .expect("Missing key from History!")
                        .as_slices();

                    let history_vec: Vec<&FeedType> = first.iter().chain(last.iter()).collect();
                    let numerical_vec: Vec<f64> = history_vec
                        .iter()
                        .filter_map(|feed| {
                            if let FeedType::Numerical(value) = feed {
                                Some(*value)
                            } else if let FeedType::Text(_) = feed {
                                warn!(
                                "Anomaly Detection not implemented for FeedType::Text, skipping..."
                            );
                                None
                            } else {
                                warn!("Anomaly Detection does not recognize FeedType, skipping...");
                                None
                            }
                        })
                        .collect();

                    // Get AD prediction only if enough data is present
                    if numerical_vec.len() > AD_MIN_DATA_POINTS_THRESHOLD {
                        match anomaly_detector_aggregate(numerical_vec) {
                            Ok(ad_score) => {
                                info!("AD_score for {:?} is {}", result_post_to_contract, ad_score);
                            }
                            Err(e) => {
                                error!("Anomaly Detection failed with error - {}", e);
                            }
                        }
                    }
                }

                info!("result_post_to_contract = {:?}", result_post_to_contract);
                reports.clear();
            }
            if is_quorum_reached {
                result_send
                    .send((
                        to_hex_string(key_post.to_be_bytes().to_vec(), None).into(),
                        naive_packing(result_post_to_contract).into(),
                    ))
                    .unwrap();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use data_feeds::feeds_processing::naive_packing;
    use feed_registry::registry::AllFeedsReports;
    use feed_registry::types::FeedMetaData;
    use std::collections::HashMap;
    use std::sync::Arc;
    use std::time::{Duration, SystemTime};
    use tokio::sync::{mpsc::unbounded_channel, RwLock};
    const QUORUM_PERCENTAGE: f32 = 0.001;

    #[tokio::test]
    async fn test_feed_slots_processor_loop() {
        // setup
        let name = "test_feed";
        let report_interval_ms = 1000; // 1 second interval
        let quorum_percentage = QUORUM_PERCENTAGE;
        let first_report_start_time = SystemTime::now();
        let feed_metadata = FeedMetaData::new(
            name,
            report_interval_ms,
            quorum_percentage,
            first_report_start_time,
            "Numerical".to_string(),
            "Average".to_string(),
        );
        let feed_metadata_arc = Arc::new(RwLock::new(feed_metadata));
        let all_feeds_reports = AllFeedsReports::new();
        let all_feeds_reports_arc = Arc::new(RwLock::new(all_feeds_reports));
        let history = Arc::new(RwLock::new(FeedAggregateHistory::new()));

        let (tx, mut rx) = unbounded_channel::<(String, String)>();

        let original_report_data = FeedType::Numerical(13.0);

        // we are specifically sending only one report message as we don't want to test the average processor
        {
            let feed_id = 1;
            let reporter_id = 42;
            all_feeds_reports_arc
                .write()
                .await
                .push(
                    feed_id,
                    reporter_id,
                    FeedResult::Result {
                        result: original_report_data.clone(),
                    },
                )
                .await;
        }

        // run
        let feed_id = 1;
        let name = name.to_string();
        let feed_metadata_arc_clone = Arc::clone(&feed_metadata_arc);
        let all_feeds_reports_arc_clone = Arc::clone(&all_feeds_reports_arc);
        {
            let mut history_guard = history.write().await;
            history_guard.register_feed(feed_id, 10_000);
        }

        let history_cp = history.clone();

        tokio::spawn(async move {
            let feed_slots_processor = FeedSlotsProcessor::new(name, feed_id);
            feed_slots_processor
                .start_loop(
                    tx,
                    feed_metadata_arc_clone,
                    all_feeds_reports_arc_clone,
                    history_cp,
                    Arc::new(RwLock::new(HashMap::new())),
                    None,
                )
                .await
                .unwrap();
        });

        // Attempt to receive with a timeout of 2 seconds
        let received = tokio::time::timeout(Duration::from_secs(2), rx.recv()).await;

        match received {
            Ok(Some((key, result))) => {
                // assert the received data
                assert_eq!(
                    key,
                    to_hex_string(feed_id.to_be_bytes().to_vec(), None),
                    "The key does not match the expected value"
                );
                assert_eq!(result, naive_packing(original_report_data));
            }
            Ok(None) => {
                panic!("The channel was closed before receiving any data");
            }
            Err(_) => {
                panic!("The channel did not receive any data within the timeout period");
            }
        }
    }

    #[tokio::test]
    async fn test_process_oneshot_feed() {
        // setup
        let current_system_time = SystemTime::now();

        // voting will start in 60 seconds
        let voting_start_time = current_system_time
            .checked_add(Duration::from_secs(6))
            .unwrap();

        // voting will be 3 seconds long
        let voting_wait_duration_ms = 3000;

        let _feed = FeedMetaData::new_oneshot(
            "TestFeed".to_string(),
            voting_wait_duration_ms,
            QUORUM_PERCENTAGE,
            voting_start_time,
        );

        let name = "test_feed";
        let feed_metadata = FeedMetaData::new_oneshot(
            name.to_string(),
            voting_wait_duration_ms,
            QUORUM_PERCENTAGE,
            voting_start_time,
        );
        let feed_metadata_arc = Arc::new(RwLock::new(feed_metadata));
        let all_feeds_reports = AllFeedsReports::new();
        let all_feeds_reports_arc = Arc::new(RwLock::new(all_feeds_reports));

        let (tx, mut rx) = unbounded_channel::<(String, String)>();

        let original_report_data = FeedType::Numerical(13.0);

        // we are specifically sending only one report message as we don't want to test the average processor
        {
            let feed_id = 1;
            let reporter_id = 42;
            all_feeds_reports_arc
                .write()
                .await
                .push(
                    feed_id,
                    reporter_id,
                    FeedResult::Result {
                        result: original_report_data.clone(),
                    },
                )
                .await;
        }

        // run
        let feed_id = 1;
        let name = name.to_string();
        let feed_metadata_arc_clone = Arc::clone(&feed_metadata_arc);
        let all_feeds_reports_arc_clone = Arc::clone(&all_feeds_reports_arc);
        let feed_aggregate_history: Arc<RwLock<FeedAggregateHistory>> =
            Arc::new(RwLock::new(FeedAggregateHistory::new()));
        let feed_aggregate_history_clone = Arc::clone(&feed_aggregate_history);
        tokio::spawn(async move {
            let feed_slots_processor = FeedSlotsProcessor::new(name, feed_id);
            feed_slots_processor
                .start_loop(
                    tx,
                    feed_metadata_arc_clone,
                    all_feeds_reports_arc_clone,
                    feed_aggregate_history_clone,
                    Arc::new(RwLock::new(HashMap::new())),
                    None,
                )
                .await
                .unwrap();
        });

        // Attempt to receive with a timeout of 2 seconds
        let received = tokio::time::timeout(Duration::from_secs(10), rx.recv()).await;

        match received {
            Ok(Some((key, result))) => {
                // assert the received data
                assert_eq!(
                    key,
                    to_hex_string(feed_id.to_be_bytes().to_vec(), None),
                    "The key does not match the expected value"
                );
                assert_eq!(result, naive_packing(original_report_data.clone()));
            }
            Ok(None) => {
                panic!("The channel was closed before receiving any data");
            }
            Err(_) => {
                panic!("The channel did not receive any data within the timeout period");
            }
        }

        tokio::time::sleep(Duration::from_millis(2000)).await;

        {
            let feed_id = 1;
            let reporter_id = 42;
            all_feeds_reports_arc
                .write()
                .await
                .push(
                    feed_id,
                    reporter_id,
                    FeedResult::Result {
                        result: original_report_data.clone(),
                    },
                )
                .await;
        }

        // Attempt to receive with a timeout of 2 seconds
        let received = tokio::time::timeout(Duration::from_secs(20), rx.recv()).await;

        // Assert that the result is an error of type Elapsed
        match received {
            Ok(Some(_)) => {
                panic!("Received unexpected data");
            }
            Ok(None) => {
                println!("Channel closed as expected");
            }
            Err(_) => {
                println!("Timeout as expected");
            }
        }
    }

    //TODO: Add a test that with quorum 0.6 and one of two reporters only reported then nothing should be written.
}
