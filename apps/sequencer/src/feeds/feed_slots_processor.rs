use crate::reporters::reporter::SharedReporters;
use crate::sequencer_state::SequencerState;
use actix_web::web::Data;
use alloy::primitives::map::HashMap;
use anomaly_detection::ingest::anomaly_detector_aggregate;
use data_feeds::feeds_processing::naive_packing;
use eyre::{eyre, Result};
use eyre::{Context, ContextCompat};
use feed_registry::aggregate::FeedAggregate;
use feed_registry::registry::AllFeedsReports;
use feed_registry::registry::FeedAggregateHistory;
use feed_registry::registry::SlotTimeTracker;
use feed_registry::types::FeedType;
use feed_registry::types::{FeedMetaData, Repeatability};
use feed_registry::types::{FeedResult, FeedsSlotProcessorCmds};
use prometheus::{inc_metric, metrics::FeedsMetrics};
use ringbuf::traits::consumer::Consumer;
use std::hash::RandomState;
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

#[derive(Debug)]
pub struct ConsumedReports {
    pub is_quorum_reached: bool,
    pub skip_publishing: bool,
    pub ad_score: Option<f64>,
    pub result_post_to_contract: Option<FeedType>,
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

    async fn get_reports_for_feed(
        &self,
        feed_id: u32,
        reports: &Arc<RwLock<AllFeedsReports>>,
    ) -> Option<Arc<RwLock<feed_registry::registry::FeedReports>>> {
        debug!("Get a read lock on all reports [feed {feed_id}]");
        let result: Option<Arc<RwLock<feed_registry::registry::FeedReports>>> =
            match reports.read().await.get(feed_id) {
                Some(x) => Some(x),
                None => {
                    info!("No reports found!");
                    None
                }
            };
        debug!("Release the read lock on all reports [feed {feed_id}]");
        result
    }

    async fn get_num_valid_reportes(&self, reporters: &SharedReporters) -> usize {
        let feed_id = self.key;
        debug!("Get a read lock on all reporters [feed {feed_id}]");
        let res = reporters.read().await.len();
        debug!("Release the read lock on all reports [feed {feed_id}]");
        res
    }

    #[allow(clippy::too_many_arguments)]
    async fn consume_reports(
        &self,
        reports: &HashMap<u64, FeedResult, RandomState>,
        feed_type: &FeedType,
        slot: u64,
        quorum_percentage: f32,
        skip_publish_if_less_then_percentage: f64,
        num_valid_reporters: usize,
        is_oneshot: bool,
        aggregator: FeedAggregate,
        history: &Arc<RwLock<FeedAggregateHistory>>,
    ) -> ConsumedReports {
        let values = self.collect_repoted_values(feed_type, reports, slot);

        if values.is_empty() {
            info!("No reports found for feed: {} slot: {}!", self.name, &slot);
            ConsumedReports {
                is_quorum_reached: false,
                skip_publishing: true,
                ad_score: None,
                result_post_to_contract: None,
            }
        } else {
            let total_votes_count = values.len() as f32;
            let required_votes_count = quorum_percentage * (num_valid_reporters as f32);
            let is_quorum_reached = required_votes_count <= total_votes_count;
            let mut skip_publishing = false;
            if !is_quorum_reached {
                warn!(
                    "Insufficient quorum of reports to post to contract for feed: {} slot: {}! Expected at least a quorum of {}, but received {} out of {} valid votes.",
                    self.name, &slot, quorum_percentage, total_votes_count, num_valid_reporters
                );
            }

            // Dispatch to concrete FeedAggregate implementation.
            let result_post_to_contract = aggregator.aggregate(&values[..]);

            let mut ad_score_opt: Option<f64> = None;

            // Oneshot feeds have no history, so we cannot perform anomaly detection on them.
            if !is_oneshot {
                if let FeedType::Numerical(candidate_value) = result_post_to_contract {
                    let ad_score = self
                        .perform_anomaly_detection(history, candidate_value)
                        .await;
                    match ad_score {
                        Ok(ad_score) => {
                            info!("AD_score for {:?} is {}", result_post_to_contract, ad_score);
                            ad_score_opt = Some(ad_score)
                        }
                        Err(e) => {
                            warn!("Anomaly Detection failed with error - {}", e);
                        }
                    }
                    if skip_publish_if_less_then_percentage > 0.0f64 {
                        skip_publishing = self
                            .check_skip_publish_if_less_then_percentage(
                                history,
                                candidate_value,
                                skip_publish_if_less_then_percentage,
                            )
                            .await;
                    }
                }
            }
            let res = ConsumedReports {
                is_quorum_reached,
                skip_publishing,
                ad_score: ad_score_opt,
                result_post_to_contract: Some(result_post_to_contract),
            };
            info!("result_post_to_contract = {:?}", res);
            res
        }
    }

    fn collect_repoted_values(
        &self,
        expected_feed_type: &FeedType,
        reports: &std::collections::HashMap<
            u64,
            std::result::Result<FeedType, feed_registry::types::FeedError>,
        >,
        slot: u64,
    ) -> Vec<FeedType> {
        let feed_id = self.key;
        let mut values: Vec<FeedType> = vec![];
        for kv in reports {
            match kv.1 {
                Ok(value) => {
                    if value.same_enum_type_as(expected_feed_type) {
                        values.push(value.clone());
                    } else {
                        warn!("Wrong value type reported by reporter {} for feed id {} slot {}! {} expected", kv.0, feed_id, slot, expected_feed_type.enum_type_to_string());
                    }
                }
                Err(_) => {
                    warn!(
                        "Got error from reporter {} for feed id {} slot {}",
                        kv.0, feed_id, slot
                    );
                }
            }
        }
        values
    }

    #[allow(clippy::too_many_arguments)]
    async fn process_end_of_slot(
        &self,
        is_oneshot: bool,
        report_interval_ms: u64,
        quorum_percentage: f32,
        skip_publish_if_less_then_percentage: f64,
        aggregator: FeedAggregate,
        slot: u64,
        feed_type: &FeedType,
        sequencer_state: &Data<SequencerState>,
        history: &Arc<RwLock<FeedAggregateHistory>>,
    ) -> Result<ConsumedReports> {
        let feed_id = self.key;
        let num_valid_reporters = {
            self.get_num_valid_reportes(&sequencer_state.reporters)
                .await
        };

        let mut consumed_reports = ConsumedReports {
            is_quorum_reached: false,
            skip_publishing: true,
            ad_score: None,
            result_post_to_contract: None,
        };

        info!(
            "Processing votes for {} with id {} for slot {} rep_interval {}.",
            self.name, self.key, slot, report_interval_ms
        );
        match self
            .get_reports_for_feed(feed_id, &sequencer_state.reports)
            .await
        {
            Some(reports) => {
                debug!("found the following reports: [feed {feed_id}]");
                debug!("reports = {reports:?} [feed {feed_id}]");
                debug!("Get a write lock on reports [feed {feed_id}]");
                let mut reports = reports.write().await;
                debug!("Acquired a write lock on reports [feed {feed_id}]");
                consumed_reports = self
                    .consume_reports(
                        &reports.report,
                        feed_type,
                        slot,
                        quorum_percentage,
                        skip_publish_if_less_then_percentage,
                        num_valid_reporters,
                        is_oneshot,
                        aggregator,
                        history,
                    )
                    .await;

                reports.clear();
                drop(reports);
                debug!("Release the write lock on reports [feed {feed_id}]");
            }
            None => {
                info!("No reports found!");
            }
        }
        Ok(consumed_reports)
    }

    async fn post_consumed_reports(
        &self,
        consumed_reports: ConsumedReports,
        feed_metrics: Option<Arc<RwLock<FeedsMetrics>>>,
        skip_publish_if_less_then_percentage: f64,
        history: &Arc<RwLock<FeedAggregateHistory>>,
        sequencer_state: &Data<SequencerState>,
    ) -> Result<()> {
        self.increase_quorum_metric(feed_metrics, consumed_reports.is_quorum_reached)
            .await;
        if !consumed_reports.is_quorum_reached {
            return Ok(());
        }
        if consumed_reports.skip_publishing {
            let feed_id = self.key;
            info!(
                "Skipping publishing for feed_id = {} change is lower then threshold of {} %",
                feed_id,
                skip_publish_if_less_then_percentage * 100.0f64
            );
            return Ok(());
        }
        let result_post_to_contract = consumed_reports.result_post_to_contract.context(
            "[post_consumed_reports]: Impossible, quorum reached but no value is reported",
        )?;
        self.post_to_contract(history, result_post_to_contract, sequencer_state)
            .await
    }

    async fn post_to_contract(
        &self,
        history: &Arc<RwLock<FeedAggregateHistory>>,
        result_post_to_contract: FeedType,
        sequencer_state: &Data<SequencerState>,
    ) -> Result<()> {
        {
            let feed_id = self.key;
            debug!("Get a write lock on history [feed {feed_id}]");
            let mut history_guard = history.write().await;
            debug!("Push result that will be posted to contract to history [feed {feed_id}]");
            history_guard.push(self.key, result_post_to_contract.clone());
            debug!("Release the write lock on history [feed {feed_id}]");
        }
        let key_post = self.key;
        let result_send = sequencer_state.voting_send_channel.clone();
        result_send
            .send((
                to_hex_string(key_post.to_be_bytes().to_vec(), None),
                naive_packing(result_post_to_contract),
            ))
            .map_err(|e| eyre!("[post_to_contract]: {e}"))
    }

    async fn check_skip_publish_if_less_then_percentage(
        &self,
        history: &Arc<RwLock<FeedAggregateHistory>>,
        candidate_value: f64,
        skip_publish_if_less_then_percentage: f64,
    ) -> bool {
        let feed_id = self.key;
        debug!("Get a read lock on history [feed {feed_id}]");
        let history_guard = history.read().await;
        let res = match history_guard.last(feed_id) {
            Some(FeedType::Numerical(last)) => {
                let a = f64::abs(*last);
                let b = f64::abs(candidate_value);
                let diff = f64::abs(last - candidate_value);
                diff < skip_publish_if_less_then_percentage * f64::max(a, b)
            }
            _ => false,
        };
        debug!("Release the read lock on history [feed {feed_id}]");
        res
    }

    async fn perform_anomaly_detection(
        &self,
        history: &Arc<RwLock<FeedAggregateHistory>>,
        candidate_value: f64,
    ) -> Result<f64, eyre::Error> {
        let feed_id = self.key;
        let history = history.clone();
        let anomaly_detection_future = async move {
            debug!("Get a read lock on history [feed {feed_id}]");
            let history_lock = history.read().await;

            // The first slice is from the current read position to the end of the array
            // The second slice represents the segment from the start of the array up to the current write position if the buffer has wrapped around
            let heap = history_lock
                .collect(feed_id)
                .context("Missing key from History!")?;
            let (first, last) = heap.as_slices();
            let history_vec: Vec<&FeedType> = first.iter().chain(last.iter()).collect();
            let mut numerical_vec: Vec<f64> = history_vec
                .iter()
                .filter_map(|feed| {
                    if let FeedType::Numerical(value) = feed {
                        Some(*value)
                    } else if let FeedType::Text(_) = feed {
                        warn!("Anomaly Detection not implemented for FeedType::Text, skipping...");
                        None
                    } else {
                        warn!("Anomaly Detection does not recognize FeedType, skipping...");
                        None
                    }
                })
                .collect();

            drop(history_lock);
            debug!("Release the read lock on history [feed {feed_id}]");

            numerical_vec.push(candidate_value);

            // Get AD prediction only if enough data is present
            if numerical_vec.len() > AD_MIN_DATA_POINTS_THRESHOLD {
                debug!("Starting anomaly detection for [feed {feed_id}]");
                anomaly_detector_aggregate(numerical_vec).map_err(|e| eyre!("{e}"))
            } else {
                Err(eyre!(
                    "Skipping anomaly detection; numerical_vec.len() = {} threshold: {}",
                    numerical_vec.len(),
                    AD_MIN_DATA_POINTS_THRESHOLD
                ))
            }
        };

        tokio::task::Builder::new()
            .name("anomaly_detection")
            .spawn(anomaly_detection_future)
            .context("Failed to spawn feed slots manager anomaly detection!")?
            .await
            .context("Failed to join feed slots manager anomaly detection!")?
    }

    async fn increase_quorum_metric(
        &self,
        feed_metrics: Option<Arc<RwLock<FeedsMetrics>>>,
        is_quorum_reached: bool,
    ) {
        if let Some(feed_metrics) = &feed_metrics {
            let key_post = self.key;
            if is_quorum_reached {
                inc_metric!(feed_metrics, key_post, quorums_reached);
            } else {
                inc_metric!(feed_metrics, key_post, failures_to_reach_quorum);
            }
        }
    }

    pub async fn start_loop(
        &self,
        sequencer_state: &Data<SequencerState>,
        feed: &Arc<RwLock<FeedMetaData>>,
        history: &Arc<RwLock<FeedAggregateHistory>>,
        feed_metrics: Option<Arc<RwLock<FeedsMetrics>>>,
        mut cmd_channel: mpsc::UnboundedReceiver<FeedsSlotProcessorCmds>,
        _cmd_sender: Option<mpsc::UnboundedSender<FeedsSlotProcessorCmds>>,
    ) -> Result<ProcessorResultValue> {
        let feed_id = self.key;
        let (
            is_oneshot,
            report_interval_ms,
            first_report_start_time,
            quorum_percentage,
            skip_publish_if_less_then_percentage,
            aggregator,
            feed_type,
        ) = {
            debug!("Get a read lock on feed meta [feed {feed_id}]");
            let datafeed = feed.read().await;
            (
                datafeed.is_oneshot(),
                datafeed.get_report_interval_ms(),
                datafeed.get_first_report_start_time_ms(),
                datafeed.get_quorum_percentage(),
                datafeed.get_skip_publish_if_less_then_percentage() as f64,
                datafeed.get_feed_aggregator(),
                datafeed.value_type.clone(),
            )
        };

        let feed_type = match feed_type.as_str() {
            "Numerical" => FeedType::Numerical(0.0f64),
            "Text" => FeedType::Text("".to_string()),
            _ => {
                return Err(eyre!(
                    "Insupported feed type {feed_type} for feed: {}",
                    self.name
                ));
            }
        };

        debug!("Release the read lock on feed meta [feed {feed_id}]");
        let feed_slots_time_tracker = SlotTimeTracker::new(
            format!("feed_processor_{}", self.key),
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
            let current_time_as_ms = current_unix_time();
            let slot = {
                if is_oneshot {
                    // Oneshots only have the zero slot
                    0_u64
                } else {
                    ((current_time_as_ms - first_report_start_time) / report_interval_ms as u128)
                        as u64
                }
            };

            // The tokio::select! macro allows waiting on multiple async computations and returns when a single computation completes.
            // The branch that does not complete is dropped. I
            tokio::select! {
                processor_cmd = FeedSlotsProcessor::read_cmd(&mut cmd_channel) => {
                    match processor_cmd {
                        FeedsSlotProcessorCmds::Terminate() => {
                            let msg = format!("Terminating processor for feed {} with id {} ", self.name, self.key);
                            info!(msg);
                            return Ok(ProcessorResultValue::ProcessorExitStatus(msg));
                        },
                    }
                },

                _ = feed_slots_time_tracker
                .await_end_of_current_slot(&repeatability) => {
                    is_processed = true;
                    match self.process_end_of_slot(
                        is_oneshot,
                        report_interval_ms,
                        quorum_percentage,
                        skip_publish_if_less_then_percentage,
                        aggregator,
                        slot,
                        &feed_type,
                        sequencer_state,
                        history,
                        ).await {
                            Ok(consumed_reports) => {
                                if let Err(e) = self.post_consumed_reports(consumed_reports, feed_metrics.clone(), skip_publish_if_less_then_percentage, history, sequencer_state).await {
                                    error!("{e}")
                                }
                            }
                            Err(e) => {
                                error!("{e}");
                            }
                        };
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
    use config::Reporter;
    use data_feeds::feeds_processing::naive_packing;
    use feed_registry::registry::AllFeedsReports;
    use feed_registry::types::FeedMetaData;
    use std::sync::Arc;
    use std::time::{Duration, SystemTime};
    use tokio::sync::RwLock;
    use utils::test_env::get_test_private_key_path;
    const QUORUM_PERCENTAGE: f32 = 0.001;
    const SKIP_PUBLISH_IF_LESS_THEN_PERCENTAGE: f32 = 1.0f32;

    #[tokio::test]
    async fn test_feed_slots_processor_loop() {
        // setup
        let name = "test_feed";
        let report_interval_ms = 1000; // 1 second interval
        let quorum_percentage = QUORUM_PERCENTAGE;
        let skip_publish_if_less_then_percentage = SKIP_PUBLISH_IF_LESS_THEN_PERCENTAGE;
        let first_report_start_time = SystemTime::now();
        let feed_metadata = FeedMetaData::new(
            name,
            report_interval_ms,
            quorum_percentage,
            skip_publish_if_less_then_percentage,
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
                .push(feed_id, reporter_id, Ok(original_report_data.clone()))
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
                    &sequencer_state,
                    &feed_metadata_arc_clone,
                    &history,
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

        // voting will start in 6 seconds
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
                .push(feed_id, reporter_id, Ok(original_report_data.clone()))
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
                    &sequencer_state,
                    &feed_metadata_arc_clone,
                    &feed_aggregate_history,
                    None,
                    cmd_recv,
                    Some(cmd_send),
                )
                .await
                .unwrap();
        });

        // Attempt to receive with a timeout of 10 seconds
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
                .push(feed_id, reporter_id, Ok(original_report_data.clone()))
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

    #[tokio::test]
    async fn test_feed_slots_processor_loop_with_quorum() {
        // A test that with quorum 0.6 and one of two reporters only reported then nothing should be written.
        // setup
        let name = "test_feed_with_quorum";
        let report_interval_ms = 100; // 0.1 second interval
        let quorum_percentage = 0.6f32;
        let skip_publish_if_less_then_percentage = SKIP_PUBLISH_IF_LESS_THEN_PERCENTAGE;
        let first_report_start_time = SystemTime::now();
        let feed_metadata = FeedMetaData::new(
            name,
            report_interval_ms,
            quorum_percentage,
            skip_publish_if_less_then_percentage,
            first_report_start_time,
            "Numerical".to_string(),
            "Average".to_string(),
            None,
        );
        let feed_metadata_arc = Arc::new(RwLock::new(feed_metadata));
        let history = Arc::new(RwLock::new(FeedAggregateHistory::new()));

        let network = "ETH2";
        let key_path = get_test_private_key_path();

        let mut cfg = get_test_config_with_single_provider(
            network,
            key_path.as_path(),
            "http://localhost:8545",
        );
        cfg.reporters.push(Reporter {
            id: 42,
            pub_key: "ea30b1533ef5638af7b70a036275642fc453ace97ed2c6b9d220fe1f59a24d61f481a777aa8a579f20e95a74cd4567ed36a3".to_string(),
        });
        cfg.reporters.push(Reporter {
            id: 14,
            pub_key: "ea30813e2f8cf968e27bad29167b41bce038a3ce9b7b368de05e5cf1af3de919eeba267b8706f55c356d5f71891eff116b98".to_string(),
        });
        let (sequencer_state, mut rx) = create_sequencer_state_from_sequencer_config(
            cfg,
            "test_feed_slots_processor_loop_with_quorum",
        )
        .await;
        //info!()
        let num_reporteds = sequencer_state.reporters.read().await.len();
        assert_eq!(num_reporteds, 2);
        // we are specifically sending only one report message as we don't want to test the average processor
        {
            let feed_id = 1;
            let reporter_id = 42;
            let original_report_data = FeedType::Numerical(110.0); // 102*1.1 = 112.2 which is greater then 110, this should be skipped

            sequencer_state
                .reports
                .write()
                .await
                .push(feed_id, reporter_id, Ok(original_report_data.clone()))
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
                    &sequencer_state,
                    &feed_metadata_arc_clone,
                    &history,
                    None,
                    cmd_recv,
                    Some(cmd_send),
                )
                .await
                .unwrap();
        });

        // Attempt to receive with a timeout of 0.2 seconds
        let received = tokio::time::timeout(Duration::from_millis(200), rx.recv()).await;

        match received {
            Ok(Some((_key, _result))) => {
                panic!("This update should be skipped based on diviation criteria");
            }
            Ok(None) => {
                panic!("The channel was closed before receiving any data");
            }
            Err(_) => {
                info!("This looks fine");
            }
        }
    }

    #[tokio::test]
    async fn test_feed_slots_processor_loop_skip_publish_based_on_low_diviation() {
        // setup
        let name = "test_feed_low_diviation";
        let report_interval_ms = 100; // 0.1 second interval
        let quorum_percentage = QUORUM_PERCENTAGE;
        let skip_publish_if_less_then_percentage = 0.1f32;
        let first_report_start_time = SystemTime::now();
        let feed_metadata = FeedMetaData::new(
            name,
            report_interval_ms,
            quorum_percentage,
            skip_publish_if_less_then_percentage,
            first_report_start_time,
            "Numerical".to_string(),
            "Average".to_string(),
            None,
        );
        let feed_metadata_arc = Arc::new(RwLock::new(feed_metadata));
        let history = Arc::new(RwLock::new(FeedAggregateHistory::new()));

        let network = "ETH2";
        let key_path = get_test_private_key_path();

        let cfg = get_test_config_with_single_provider(
            network,
            key_path.as_path(),
            "http://localhost:8545",
        );

        let (sequencer_state, mut rx) = create_sequencer_state_from_sequencer_config(
            cfg,
            "test_feed_slots_processor_loop_skip_publish_based_on_low_diviation",
        )
        .await;

        // we are specifically sending only one report message as we don't want to test the average processor
        {
            let feed_id = 1;
            let reporter_id = 42;
            let original_report_data = FeedType::Numerical(110.0); // 102*1.1 = 112.2 which is greater then 110, this should be skipped

            sequencer_state
                .reports
                .write()
                .await
                .push(feed_id, reporter_id, Ok(original_report_data.clone()))
                .await;
        }

        // run
        let feed_id = 1;
        let name = name.to_string();
        let feed_metadata_arc_clone = Arc::clone(&feed_metadata_arc);
        {
            let mut history_guard = history.write().await;
            history_guard.register_feed(feed_id, 10_000);
            history_guard.push(feed_id, FeedType::Numerical(130.0));
            history_guard.push(feed_id, FeedType::Numerical(120.0));
            history_guard.push(feed_id, FeedType::Numerical(102.0));
        }

        tokio::spawn(async move {
            let feed_slots_processor = FeedSlotsProcessor::new(name, feed_id);
            let (cmd_send, cmd_recv) = mpsc::unbounded_channel();

            feed_slots_processor
                .start_loop(
                    &sequencer_state,
                    &feed_metadata_arc_clone,
                    &history,
                    None,
                    cmd_recv,
                    Some(cmd_send),
                )
                .await
                .unwrap();
        });

        // Attempt to receive with a timeout of 0.2 seconds
        let received = tokio::time::timeout(Duration::from_millis(200), rx.recv()).await;

        match received {
            Ok(Some((_key, _result))) => {
                panic!("This update should be skipped based on diviation criteria");
            }
            Ok(None) => {
                panic!("The channel was closed before receiving any data");
            }
            Err(_) => {
                info!("This looks fine");
            }
        }
    }

    #[tokio::test]
    async fn test_feed_slots_processor_loop_skip_publish_based_on_low_diviation_2() {
        // setup
        let name = "test_feed_low_diviation_2";
        let report_interval_ms = 100; // 0.1 second interval
        let quorum_percentage = QUORUM_PERCENTAGE;
        let skip_publish_if_less_then_percentage = 0.1f32;
        let first_report_start_time = SystemTime::now();
        let feed_metadata = FeedMetaData::new(
            name,
            report_interval_ms,
            quorum_percentage,
            skip_publish_if_less_then_percentage,
            first_report_start_time,
            "Numerical".to_string(),
            "Average".to_string(),
            None,
        );
        let feed_metadata_arc = Arc::new(RwLock::new(feed_metadata));
        let history = Arc::new(RwLock::new(FeedAggregateHistory::new()));

        let network = "ETH2";
        let key_path = get_test_private_key_path();

        let cfg = get_test_config_with_single_provider(
            network,
            key_path.as_path(),
            "http://localhost:8545",
        );

        let (sequencer_state, mut rx) = create_sequencer_state_from_sequencer_config(
            cfg,
            "test_feed_slots_processor_loop_skip_publish_based_on_low_diviation_2",
        )
        .await;

        // we are specifically sending only one report message as we don't want to test the average processor
        {
            let feed_id = 1;
            let reporter_id = 42;
            let original_report_data = FeedType::Numerical(115.0); // 102*1.1 = 112.2 which is lower then 115, this should be published

            sequencer_state
                .reports
                .write()
                .await
                .push(feed_id, reporter_id, Ok(original_report_data.clone()))
                .await;
        }

        // run
        let feed_id = 1;
        let name = name.to_string();
        let feed_metadata_arc_clone = Arc::clone(&feed_metadata_arc);
        {
            let mut history_guard = history.write().await;
            history_guard.register_feed(feed_id, 10_000);
            history_guard.push(feed_id, FeedType::Numerical(130.0));
            history_guard.push(feed_id, FeedType::Numerical(120.0));
            history_guard.push(feed_id, FeedType::Numerical(102.0));
        }

        tokio::spawn(async move {
            let feed_slots_processor = FeedSlotsProcessor::new(name, feed_id);
            let (cmd_send, cmd_recv) = mpsc::unbounded_channel();

            feed_slots_processor
                .start_loop(
                    &sequencer_state,
                    &feed_metadata_arc_clone,
                    &history,
                    None,
                    cmd_recv,
                    Some(cmd_send),
                )
                .await
                .unwrap();
        });

        // Attempt to receive with a timeout of 0.2 seconds
        let received = tokio::time::timeout(Duration::from_millis(200), rx.recv()).await;

        match received {
            Ok(Some((key, result))) => {
                assert_eq!(
                    key,
                    to_hex_string(feed_id.to_be_bytes().to_vec(), None),
                    "The key does not match the expected value"
                );
                assert_eq!(result, naive_packing(FeedType::Numerical(115.0)));
            }
            Ok(None) => {
                panic!("The channel was closed before receiving any data");
            }
            Err(_) => {
                panic!("The channel did not receive any data within the timeout period");
            }
        }
    }
}
