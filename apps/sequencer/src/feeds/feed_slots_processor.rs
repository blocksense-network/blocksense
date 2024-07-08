use crate::feeds::feeds_registry::AllFeedsReports;
use crate::feeds::feeds_registry::FeedMetaData;
use crate::utils::time_utils::{get_ms_since_epoch, SlotTimeTracker};
use data_feeds::feeds_processing::naive_packing;
use data_feeds::types::FeedType;
use eyre::Report;
use std::fmt::Debug;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tokio::sync::mpsc::UnboundedSender;
use tracing::{debug, info};
use utils::to_hex_string;

use super::feeds_registry::FeedAggregateHistory;

pub async fn feed_slots_processor_loop<
    K: Debug + Clone + std::string::ToString + 'static + std::convert::From<std::string::String>,
    V: Debug + Clone + std::string::ToString + 'static + std::convert::From<std::string::String>,
>(
    result_send: UnboundedSender<(K, V)>,
    feed: Arc<RwLock<FeedMetaData>>,
    name: String,
    report_interval_ms: u64,
    first_report_start_time: u128,
    reports: Arc<RwLock<AllFeedsReports>>,
    history: Arc<RwLock<FeedAggregateHistory>>,
    key: u32,
) -> Result<String, Report> {
    let feed_slots_time_tracker = SlotTimeTracker::new(
        Duration::from_millis(report_interval_ms),
        first_report_start_time,
    );

    loop {
        feed_slots_time_tracker.await_end_of_current_slot().await;

        let result_post_to_contract: FeedType; //TODO(snikolov): This needs to be enforced as Bytes32
        let key_post: u32;
        {
            let current_time_as_ms = get_ms_since_epoch();

            let slot = feed.read().unwrap().get_slot(current_time_as_ms);

            info!(
                "Processing votes for {} with id {} for slot {} rep_interval {}.",
                name, key, slot, report_interval_ms
            );

            let reports: Arc<RwLock<crate::feeds::feeds_registry::FeedReports>> =
                match reports.read().unwrap().get(key) {
                    Some(x) => x,
                    None => {
                        info!("No reports found!");
                        continue;
                    }
                };
            debug!("found the following reports:");
            debug!("reports = {:?}", reports);

            let mut reports = reports.write().unwrap();
            // Process the reports:
            let mut values: Vec<&FeedType> = vec![];
            for kv in &reports.report {
                values.push(&kv.1);
            }

            if values.is_empty() {
                info!("No reports found for slot {}!", &slot);
                continue;
            }

            key_post = key;
            result_post_to_contract = feed.read().unwrap().get_feed_type().aggregate(values); // Dispatch to concrete FeedAggregate implementation.

            {
                //TODO(snikolov): Is this thread-safe?
                let mut history_guard = history.write().unwrap();
                history_guard.push(key, result_post_to_contract.clone())
            }

            info!("result_post_to_contract = {:?}", result_post_to_contract);
            reports.clear();
        }

        result_send
            .send((
                to_hex_string(key_post.to_be_bytes().to_vec(), None).into(),
                naive_packing(result_post_to_contract).into(),
            ))
            .unwrap();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::feeds::feeds_registry::{AllFeedsReports, FeedMetaData};
    use data_feeds::feeds_processing::naive_packing;
    use std::sync::{Arc, RwLock};
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use tokio::sync::mpsc::unbounded_channel;

    //TODO(snikolov): Fix test after PR125 is merged
    #[tokio::test]
    async fn test_feed_slots_processor_loop() {
        // setup
        let name = "test_feed";
        let report_interval_ms = 1000; // 1 second interval
        let first_report_start_time = SystemTime::now();
        let feed_metadata = FeedMetaData::new(name, report_interval_ms, first_report_start_time);
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
            all_feeds_reports_arc.write().unwrap().push(
                feed_id,
                reporter_id,
                original_report_data.clone(),
            );
        }

        // run
        let feed_id = 1;
        let name = name.to_string();
        let feed_metadata_arc_clone = Arc::clone(&feed_metadata_arc);
        let all_feeds_reports_arc_clone = Arc::clone(&all_feeds_reports_arc);

        tokio::spawn(async move {
            feed_slots_processor_loop(
                tx,
                feed_metadata_arc_clone,
                name,
                report_interval_ms,
                first_report_start_time
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_millis(),
                all_feeds_reports_arc_clone,
                history,
                feed_id,
            )
            .await
            .unwrap();
        });

        // Attempt to receive with a timeout of 2 seconds
        let received = tokio::time::timeout(Duration::from_secs(2), rx.recv()).await;

        match received {
            Ok(Some((key, result))) => {
                /// assert the received data
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
}
