use crate::sequencer_state::SequencerState;
use actix_web::web::Data;
use anomaly_detection::ingest::anomaly_detector_aggregate;
use data_feeds::feeds_processing::naive_packing;
use eyre::Result;
use feed_registry::registry::FeedAggregateHistory;
use feed_registry::registry::SlotTimeTracker;
use feed_registry::types::FeedType;
use feed_registry::types::{FeedMetaData, Repeatability};
use feed_registry::types::{FeedResult, FeedsSlotProcessorCmds};
use prometheus::{inc_metric, metrics::FeedsMetrics};
use ringbuf::traits::consumer::Consumer;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::sync::RwLock;
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

    async fn read_cmd(
        cmd_channel: &mut mpsc::UnboundedReceiver<FeedsSlotProcessorCmds>,
    ) -> FeedsSlotProcessorCmds {
        loop {
            let cmd = cmd_channel.recv().await;
            if let Some(cmd) = cmd {
                return cmd;
            }
        }
    }

    pub async fn start_loop(
        &self,
        sequencer_state: Data<SequencerState>,
        feed: Arc<RwLock<FeedMetaData>>,
        history: Arc<RwLock<FeedAggregateHistory>>,
        feed_metrics: Option<Arc<RwLock<FeedsMetrics>>>,
        mut cmd_channel: mpsc::UnboundedReceiver<FeedsSlotProcessorCmds>,
        _cmd_sender: Option<mpsc::UnboundedSender<FeedsSlotProcessorCmds>>,
    ) -> Result<ProcessorResultValue> {
        let result_send = sequencer_state.voting_send_channel.clone();
        let reports = sequencer_state.reports.clone();
        let reporters = sequencer_state.reporters.clone();
        let feed_type = feed.read().await.value_type.clone();

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

            tokio::select! {
                processor_cmd = FeedSlotsProcessor::read_cmd(&mut cmd_channel) => {
                    match processor_cmd {
                        FeedsSlotProcessorCmds::Terminate() => {
                            let msg = format!("Terminating processor for feed {} with id {} ", self.name, self.key);
                            info!(msg);
                            return Ok(ProcessorResultValue::ProcessorExitStatus(msg));
                        },
                    }
                }

                _ = feed_slots_time_tracker
                .await_end_of_current_slot(&repeatability) => {
                    is_processed = true;

                    let result_post_to_contract: FeedType; //TODO(snikolov): This needs to be enforced as Bytes32
                    let key_post: u32;
                    let mut is_quorum_reached = true;

                    {
                        let current_time_as_ms = current_unix_time();
                        let feed_id = self.key;

                        debug!("Get a read lock on feed meta [feed {feed_id}]");
                        let slot = feed.read().await.get_slot(current_time_as_ms);
                        debug!("Release the read lock on feed meta [feed {feed_id}]");

                        info!(
                            "Processing votes for {} with id {} for slot {} rep_interval {}.",
                            self.name, self.key, slot, report_interval_ms
                        );

                        debug!("Get a read lock on all reports [feed {feed_id}]");
                        let reports =
                            match reports.read().await.get(self.key) {
                                Some(x) => x,
                                None => {
                                    info!("No reports found!");
                                    debug!("Release the read lock on all reports (continue) [feed {feed_id}]");
                                    continue;
                                }
                            };
                        debug!("Release the read lock on all reports [feed {feed_id}]");

                        debug!("found the following reports: [feed {feed_id}]");
                        debug!("reports = {reports:?} [feed {feed_id}]");

                        debug!("Get a write lock on reports [feed {feed_id}]");
                        let mut reports = reports.write().await;
                        debug!("Acquired a write lock on reports [feed {feed_id}]");
                        // Process the reports:
                        let mut values: Vec<&FeedType> = vec![];
                        for kv in &reports.report {
                            match kv.1 {
                                FeedResult::Result { result } => {
                                    match &result {
                                        FeedType::Numerical(_) => {
                                            if feed_type == "Numerical" {
                                                values.push(result)
                                            } else {
                                                warn!("Wrong value type reported by reporter {} for feed id {} slot {}! value_type = Numerical expected", kv.0, self.key, slot);
                                            }
                                        },
                                        FeedType::Text(_) => {
                                            if feed_type == "Text" {
                                                values.push(result)
                                            } else {
                                                warn!("Wrong value type reported by reporter {} for feed id {} slot {}! value_type = Text expected", kv.0, self.key, slot);
                                            }
                                        }
                                    };
                                },
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
                            debug!("Release the write lock on reports [feed {feed_id}]");
                            continue;
                        }

                        debug!("Get a read lock on all reporters [feed {feed_id}]");
                        let all_reporters_count = reporters.read().await.len();
                        debug!("Release the read lock on all reports [feed {feed_id}]");

                        let total_votes_count = values.len() as f32;
                        let required_votes_count = quorum_percentage * all_reporters_count as f32;

                        if total_votes_count < required_votes_count {
                            warn!(
                            "Insufficient quorum of reports to post to contract for feed: {} slot: {}! Expected at least a quorum of {}, but received {} out of {} valid votes.",
                            self.name, &slot, quorum_percentage, total_votes_count, all_reporters_count
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

                        debug!("Get a read lock on feed meta to aggregate votes [feed {feed_id}]");
                        // Dispatch to concrete FeedAggregate implementation.
                        result_post_to_contract = feed.read().await.get_feed_aggregator().aggregate(values);
                        debug!("Release the read lock on feed meta to aggregate votes [feed {feed_id}]");

                        // Oneshot feeds have no history, so we cannot perform anomaly detection on them.
                        if !is_oneshot {
                            {
                                debug!("Get a write lock on history [feed {feed_id}]");
                                let mut history_guard = history.write().await;
                                debug!("Push result that will be posted to contract to history [feed {feed_id}]");
                                history_guard.push(self.key, result_post_to_contract.clone());
                                debug!("Release the write lock on history [feed {feed_id}]");
                            }

                            debug!("Get a read lock on history [feed {feed_id}]");
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

                            drop(history_lock);
                            debug!("Release the read lock on history [feed {feed_id}]");

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
                        debug!("Release the write lock on reports [feed {feed_id}]");
                    }
                    if is_quorum_reached {
                        result_send
                            .send((
                                to_hex_string(key_post.to_be_bytes().to_vec(), None),
                                naive_packing(result_post_to_contract),
                            ))
                            .unwrap();
                    }
                }
            };
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::testing::sequencer_state::create_sequencer_state_from_sequencer_config;

    use super::*;
    use config::get_test_config_with_single_provider;
    use data_feeds::feeds_processing::naive_packing;
    use feed_registry::registry::AllFeedsReports;
    use feed_registry::types::FeedMetaData;
    use std::sync::Arc;
    use std::time::{Duration, SystemTime};
    use tokio::sync::RwLock;
    use utils::test_env::get_test_private_key_path;
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
            None,
        );
        let feed_metadata_arc = Arc::new(RwLock::new(feed_metadata));
        let history = Arc::new(RwLock::new(FeedAggregateHistory::new()));

        let original_report_data = FeedType::Numerical(13.0);

        let network = "ETH2";
        let key_path = get_test_private_key_path();

        let cfg = get_test_config_with_single_provider(
            network,
            key_path.as_path(),
            "http://localhost:8545",
        );

        let (sequencer_state, mut rx) =
            create_sequencer_state_from_sequencer_config(cfg, "test_feed_slots_processor_loop")
                .await;

        // we are specifically sending only one report message as we don't want to test the average processor
        {
            let feed_id = 1;
            let reporter_id = 42;
            sequencer_state
                .reports
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
        {
            let mut history_guard = history.write().await;
            history_guard.register_feed(feed_id, 10_000);
        }

        tokio::spawn(async move {
            let feed_slots_processor = FeedSlotsProcessor::new(name, feed_id);
            let (cmd_send, cmd_recv) = mpsc::unbounded_channel();

            feed_slots_processor
                .start_loop(
                    sequencer_state,
                    feed_metadata_arc_clone,
                    history,
                    None,
                    cmd_recv,
                    Some(cmd_send),
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

        let original_report_data = FeedType::Text("13.00".to_string());

        let network = "ETH2";
        let key_path = get_test_private_key_path();

        let cfg = get_test_config_with_single_provider(
            network,
            key_path.as_path(),
            "http://localhost:8545",
        );

        let (sequencer_state, mut rx) =
            create_sequencer_state_from_sequencer_config(cfg, "test_process_oneshot_feed").await;

        // we are specifically sending only one report message as we don't want to test the average processor
        {
            let feed_id = 1;
            let reporter_id = 42;
            sequencer_state
                .reports
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
        let feed_aggregate_history: Arc<RwLock<FeedAggregateHistory>> =
            Arc::new(RwLock::new(FeedAggregateHistory::new()));
        let (cmd_send, cmd_recv) = mpsc::unbounded_channel();
        tokio::spawn(async move {
            let feed_slots_processor = FeedSlotsProcessor::new(name, feed_id);
            feed_slots_processor
                .start_loop(
                    sequencer_state,
                    feed_metadata_arc_clone,
                    feed_aggregate_history,
                    None,
                    cmd_recv,
                    Some(cmd_send),
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
