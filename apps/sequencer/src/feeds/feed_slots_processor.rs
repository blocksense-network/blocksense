use crate::reporters::reporter::SharedReporters;
use crate::sequencer_state::SequencerState;
use actix_web::web::Data;
use data_feeds::feeds_processing::VotedFeedUpdateWithProof;
use eyre::{eyre, ContextCompat, Result};
use feed_registry::aggregate::FeedAggregate;
use feed_registry::feed_registration_cmds::ProcessorResultValue;
use feed_registry::registry::{AllFeedsReports, FeedAggregateHistory, SlotTimeTracker};
use feed_registry::types::{
    FeedMetaData, FeedType, FeedsSlotProcessorCmds, Repeatability, Timestamp,
};
use feeds_processing::utils::{consume_reports, ConsumedReports};
use prometheus::{inc_metric, metrics::FeedsMetrics};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::sync::RwLock;
use tracing::error;
use tracing::{debug, info};
use utils::time::current_unix_time;

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
    async fn process_end_of_slot(
        &self,
        is_oneshot: bool,
        report_interval_ms: u64,
        quorum_percentage: f32,
        skip_publish_if_less_then_percentage: f64,
        always_publish_heartbeat_ms: Option<u128>,
        end_slot_timestamp: Timestamp,
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
            end_slot_timestamp,
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
                consumed_reports = consume_reports(
                    self.name.as_str(),
                    &reports.report,
                    feed_type,
                    slot,
                    quorum_percentage,
                    skip_publish_if_less_then_percentage,
                    always_publish_heartbeat_ms,
                    end_slot_timestamp,
                    num_valid_reporters,
                    is_oneshot,
                    aggregator,
                    history,
                    feed_id,
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
        let feed_id = self.key;
        self.increase_quorum_metric(feed_metrics, consumed_reports.is_quorum_reached)
            .await;

        if !consumed_reports.is_quorum_reached {
            debug!("Quorum not reached for feed_id = {feed_id}");
            return Ok(());
        }

        if consumed_reports.skip_publishing {
            info!(
                "Skipping publishing for feed_id = {} change is lower then threshold of {} %",
                feed_id, skip_publish_if_less_then_percentage
            );
            return Ok(());
        }

        let result_post_to_contract = consumed_reports.result_post_to_contract.context(
            "[post_consumed_reports]: Impossible, quorum reached but no value is reported",
        )?;

        debug!("Awaiting post_to_contract... [feed {feed_id}]");
        let result = self
            .post_to_contract(history, result_post_to_contract, sequencer_state)
            .await;
        debug!("Continued after post_to_contract [feed {feed_id}]");
        result
    }

    async fn post_to_contract(
        &self,
        history: &Arc<RwLock<FeedAggregateHistory>>,
        message: VotedFeedUpdateWithProof,
        sequencer_state: &Data<SequencerState>,
    ) -> Result<()> {
        {
            let feed_id = self.key;
            debug!("Get a write lock on history [feed {feed_id}]");
            let mut history_guard = history.write().await;
            debug!("Push result that will be posted to contract to history [feed {feed_id}]");
            history_guard.push_next(
                self.key,
                message.update.value.clone(),
                message.update.end_slot_timestamp,
            );
            debug!("Release the write lock on history [feed {feed_id}]");
        }
        let result_send = sequencer_state
            .aggregated_votes_to_block_creator_send
            .clone();
        result_send
            .send(message)
            .map_err(|e| eyre!("[post_to_contract]: {e}"))
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
            always_publish_heartbeat_ms,
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
                datafeed.get_always_publish_heartbeat_ms(),
                datafeed.get_feed_aggregator(),
                datafeed.value_type.clone(),
            )
        };

        let feed_type = FeedType::get_variant_from_string(feed_type.as_str())
            .map_err(|msg| eyre!("{msg} for feed: {}", self.name))?;

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
                    let end_slot_timestamp = first_report_start_time + (report_interval_ms as u128) * (slot as u128 + 1);

                    debug!("Awaiting process_end_of_slot [feed {}]", self.key);
                    match self.process_end_of_slot(
                        is_oneshot,
                        report_interval_ms,
                        quorum_percentage,
                        skip_publish_if_less_then_percentage,
                        always_publish_heartbeat_ms,
                        end_slot_timestamp,
                        aggregator,
                        slot,
                        &feed_type,
                        sequencer_state,
                        history,
                        ).await {
                            Ok(consumed_reports) => {
                                debug!("Continued after process_end_of_slot [feed {}]", self.key);
                                if let Err(e) = self.post_consumed_reports(consumed_reports, feed_metrics.clone(), skip_publish_if_less_then_percentage, history, sequencer_state).await {
                                    error!("post_consumed_reports failed with {e}")
                                }
                            }
                            Err(e) => {
                                error!("process_end_of_slot failed with {e}");
                            }
                        };
                }
            };
        }
    }
}

#[cfg(test)]
pub mod tests {

    use super::*;
    use crate::http_handlers::data_feeds::tests::some_feed_config_with_id_1;
    use crate::sequencer_state::create_sequencer_state_from_sequencer_config;
    use config::get_test_config_with_single_provider;
    use config::AllFeedsConfig;
    use config::Reporter;
    use feed_registry::registry::AllFeedsReports;
    use feed_registry::types::test_payload_from_result;
    use feed_registry::types::FeedMetaData;
    use std::sync::Arc;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use tokio::sync::RwLock;
    use tokio::time::error::Elapsed;
    use utils::test_env::get_test_private_key_path;

    pub fn check_received(
        received: Result<Option<VotedFeedUpdateWithProof>, Elapsed>,
        expected: (u32, FeedType),
    ) {
        let feed_id = expected.0;
        let original_report_data = expected.1;
        match received {
            Ok(Some(vote)) => {
                assert_eq!(
                    feed_id, vote.update.feed_id,
                    "The key does not match the expected value"
                );
                assert_eq!(vote.update.value, original_report_data);
            }
            Ok(None) => {
                panic!("The channel was closed before receiving any data");
            }
            Err(_) => {
                panic!("The channel did not receive any data within the timeout period");
            }
        }
    }

    pub fn check_timeout_expected(received: Result<Option<VotedFeedUpdateWithProof>, Elapsed>) {
        // Assert that the result is an error of type Elapsed
        match received {
            Ok(Some(_)) => {
                panic!("Received unexpected data");
            }
            Ok(None) => {
                panic!("The channel was closed before receiving any data");
            }
            Err(_) => {
                println!("Timeout as expected");
            }
        }
    }

    pub fn check_channel_is_closed(received: Result<Option<VotedFeedUpdateWithProof>, Elapsed>) {
        // Assert that the result is an error of type Elapsed
        match received {
            Ok(Some(_)) => {
                panic!("Received unexpected data");
            }
            Ok(None) => {
                println!("Channel closed as expected");
            }
            Err(_) => {
                panic!("The channel received timeout when it should be closed");
            }
        }
    }

    #[tokio::test]
    async fn test_feed_slots_processor_loop() {
        // setup
        let name = "test_feed_slots_processor_loop";
        let metrics_prefix = name;
        let report_interval_ms = 1000; // 1 second interval
        let quorum_percentage = 100.0; // 100%
        let skip_publish_if_less_then_percentage = 10.0; // 10%
        let first_report_start_time = SystemTime::now();
        let always_publish_heartbeat_ms = None;
        let feed_metadata = FeedMetaData::new(
            name,
            report_interval_ms,
            quorum_percentage,
            skip_publish_if_less_then_percentage,
            always_publish_heartbeat_ms,
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

        let feeds_config = AllFeedsConfig { feeds: vec![] };
        let (sequencer_state, mut rx, _, _, _) =
            create_sequencer_state_from_sequencer_config(cfg, metrics_prefix, feeds_config).await;

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
                    test_payload_from_result(Ok(original_report_data.clone())),
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
        let received: std::result::Result<
            Option<VotedFeedUpdateWithProof>,
            tokio::time::error::Elapsed,
        > = tokio::time::timeout(Duration::from_secs(2), rx.recv()).await;
        check_received(received, (feed_id, original_report_data));
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

        let name = "test_process_oneshot_feed";
        let metics_prefix = name;
        let feed_metadata = FeedMetaData::new_oneshot(
            name.to_string(),
            voting_wait_duration_ms,
            100.0, // 100%
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
        let feeds_config = AllFeedsConfig { feeds: vec![] };
        let (sequencer_state, mut rx, _, _, _) =
            create_sequencer_state_from_sequencer_config(cfg, metics_prefix, feeds_config).await;

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
                    test_payload_from_result(Ok(original_report_data.clone())),
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
        check_received(received, (feed_id, original_report_data.clone()));

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
                    test_payload_from_result(Ok(original_report_data.clone())),
                )
                .await;
        }

        // Attempt to receive with a timeout of 2 seconds
        let received = tokio::time::timeout(Duration::from_secs(20), rx.recv()).await;
        check_channel_is_closed(received);
    }

    #[tokio::test]
    async fn test_feed_slots_processor_loop_with_quorum() {
        // A test that with quorum 0.6 and one of two reporters only reported then nothing should be written.
        // setup
        let name = "test_feed_slots_processor_loop_with_quorum";
        let metrics_prefix = name;
        let report_interval_ms = 100; // 0.1 second interval
        let quorum_percentage = 60.0f32;
        let skip_publish_if_less_then_percentage = 10.0f32; // 10%
        let first_report_start_time = SystemTime::now();
        let always_publish_heartbeat_ms = None;
        let feed_metadata = FeedMetaData::new(
            name,
            report_interval_ms,
            quorum_percentage,
            skip_publish_if_less_then_percentage,
            always_publish_heartbeat_ms,
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
            address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".to_string(),
        });
        cfg.reporters.push(Reporter {
            id: 14,
            pub_key: "ea30813e2f8cf968e27bad29167b41bce038a3ce9b7b368de05e5cf1af3de919eeba267b8706f55c356d5f71891eff116b98".to_string(),
            address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8".to_string(),
        });

        let feeds_config = AllFeedsConfig {
            feeds: vec![some_feed_config_with_id_1()],
        };

        let (sequencer_state, mut rx, _, _, _) =
            create_sequencer_state_from_sequencer_config(cfg, metrics_prefix, feeds_config).await;
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
                .push(
                    feed_id,
                    reporter_id,
                    test_payload_from_result(Ok(original_report_data.clone())),
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
        // This update should be skipped based on diviation criteria
        check_timeout_expected(received);
    }

    #[tokio::test]
    async fn test_feed_slots_processor_loop_skip_publish_based_on_low_diviation() {
        // setup
        let name = "test_feed_slots_processor_loop_skip_publish_based_on_low_diviation";
        let metrics_prefix = name;
        let report_interval_ms = 100; // 0.1 second interval
        let quorum_percentage = 100.0f32; //100%
        let skip_publish_if_less_then_percentage = 10.0f32; // 10%
        let first_report_start_time =
            SystemTime::now() - Duration::from_millis(report_interval_ms * 3);
        let always_publish_heartbeat_ms = None;
        let feed_metadata = FeedMetaData::new(
            name,
            report_interval_ms,
            quorum_percentage,
            skip_publish_if_less_then_percentage,
            always_publish_heartbeat_ms,
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
        let feeds_config = AllFeedsConfig {
            feeds: vec![some_feed_config_with_id_1()],
        };
        let (sequencer_state, mut rx, _, _, _) =
            create_sequencer_state_from_sequencer_config(cfg, metrics_prefix, feeds_config).await;

        // we are specifically sending only one report message as we don't want to test the average processor
        {
            let feed_id = 1;
            let reporter_id = 42;
            let original_report_data = FeedType::Numerical(110.0); // 102*1.1 = 112.2 which is greater then 110, this should be skipped

            sequencer_state
                .reports
                .write()
                .await
                .push(
                    feed_id,
                    reporter_id,
                    test_payload_from_result(Ok(original_report_data.clone())),
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
            let since_the_epoch = first_report_start_time
                .duration_since(UNIX_EPOCH)
                .expect("Time went backwards");
            let slot_start_in_ms = since_the_epoch.as_millis();
            history_guard.push_next(
                feed_id,
                FeedType::Numerical(130.0),
                slot_start_in_ms + 1 * report_interval_ms as u128,
            );
            history_guard.push_next(
                feed_id,
                FeedType::Numerical(120.0),
                slot_start_in_ms + 2 * report_interval_ms as u128,
            );
            history_guard.push_next(
                feed_id,
                FeedType::Numerical(102.0),
                slot_start_in_ms + 3 * report_interval_ms as u128,
            );
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
        check_timeout_expected(received);
    }

    #[tokio::test]
    async fn test_feed_slots_processor_loop_skip_publish_based_on_low_diviation_2() {
        // setup
        let name = "test_feed_slots_processor_loop_skip_publish_based_on_low_diviation_2";
        let metrics_prefix = name;

        let report_interval_ms = 100; // 0.1 second interval
        let quorum_percentage = 100.0f32; // 100%
        let skip_publish_if_less_then_percentage = 10.0f32; // 10%
        let first_report_start_time =
            SystemTime::now() - Duration::from_millis(report_interval_ms * 3);
        let always_publish_heartbeat_ms = None;
        let feed_metadata = FeedMetaData::new(
            name,
            report_interval_ms,
            quorum_percentage,
            skip_publish_if_less_then_percentage,
            always_publish_heartbeat_ms,
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
        let feeds_config = AllFeedsConfig {
            feeds: vec![some_feed_config_with_id_1()],
        };
        let (sequencer_state, mut rx, _, _, _) =
            create_sequencer_state_from_sequencer_config(cfg, metrics_prefix, feeds_config).await;

        // we are specifically sending only one report message as we don't want to test the average processor
        {
            let feed_id = 1;
            let reporter_id = 42;
            let original_report_data = FeedType::Numerical(115.0); // 102*1.1 = 112.2 which is lower then 115, this should be published

            sequencer_state
                .reports
                .write()
                .await
                .push(
                    feed_id,
                    reporter_id,
                    test_payload_from_result(Ok(original_report_data.clone())),
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
            let since_the_epoch = first_report_start_time
                .duration_since(UNIX_EPOCH)
                .expect("Time went backwards");
            let slot_start_in_ms = since_the_epoch.as_millis();
            history_guard.push_next(
                feed_id,
                FeedType::Numerical(130.0),
                slot_start_in_ms + 1 * report_interval_ms as u128,
            );
            history_guard.push_next(
                feed_id,
                FeedType::Numerical(120.0),
                slot_start_in_ms + 2 * report_interval_ms as u128,
            );
            history_guard.push_next(
                feed_id,
                FeedType::Numerical(102.0),
                slot_start_in_ms + 3 * report_interval_ms as u128,
            );
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
        check_received(received, (feed_id, FeedType::Numerical(115.0)));
    }

    async fn run_feed_slots_processor_loop_always_publish_heartbeat(
        name: &str,
        always_publish_heartbeat_ms: Option<u128>,
    ) -> std::result::Result<Option<VotedFeedUpdateWithProof>, tokio::time::error::Elapsed> {
        let metrics_prefix = name;
        let report_interval_ms = 100; // 0.1 second interval
        let quorum_percentage = 60.0f32; // 60 %
        let skip_publish_if_less_then_percentage = 50.0f32; // 50%
        let first_report_start_time =
            SystemTime::now() - Duration::from_millis(report_interval_ms * 3);
        let feed_metadata = FeedMetaData::new(
            name,
            report_interval_ms,
            quorum_percentage,
            skip_publish_if_less_then_percentage,
            always_publish_heartbeat_ms,
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
        let all_feed_config = AllFeedsConfig {
            feeds: vec![some_feed_config_with_id_1()],
        };
        let (sequencer_state, mut rx, _, _, _) =
            create_sequencer_state_from_sequencer_config(cfg, metrics_prefix, all_feed_config)
                .await;

        // we are specifically sending only one report message as we don't want to test the average processor
        {
            let feed_id = 1;
            let reporter_id = 42;
            let original_report_data = FeedType::Numerical(102.0);

            sequencer_state
                .reports
                .write()
                .await
                .push(
                    feed_id,
                    reporter_id,
                    test_payload_from_result(Ok(original_report_data.clone())),
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
            let since_the_epoch = first_report_start_time
                .duration_since(UNIX_EPOCH)
                .expect("Time went backwards");
            let slot_start_in_ms = since_the_epoch.as_millis();
            history_guard.push_next(
                feed_id,
                FeedType::Numerical(102.1),
                slot_start_in_ms + 1 * report_interval_ms as u128,
            );
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
        tokio::time::timeout(Duration::from_millis(200), rx.recv()).await
    }

    #[tokio::test]
    async fn test_feed_slots_processor_loop_always_publish_heartbeat() {
        // setup
        let name = "test_feed_slots_processor_loop_always_publish_heartbeat";
        let always_publish_heartbeat_ms = Some(300_u128);
        let received = run_feed_slots_processor_loop_always_publish_heartbeat(
            name,
            always_publish_heartbeat_ms,
        )
        .await;
        check_received(received, (1_u32, FeedType::Numerical(102.0)));
    }

    #[tokio::test]
    async fn test_feed_slots_processor_loop_always_publish_heartbeat_2() {
        // setup
        let name = "test_feed_slots_processor_loop_always_publish_heartbeat_2";
        let always_publish_heartbeat_ms = Some(900_u128);
        let received = run_feed_slots_processor_loop_always_publish_heartbeat(
            name,
            always_publish_heartbeat_ms,
        )
        .await;
        check_timeout_expected(received);
    }
}
