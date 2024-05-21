use crate::feeds::feeds_registry::{FeedMetaData, FeedSlotTimeTracker};
use crate::feeds::feeds_state::FeedsState;
use crate::utils::byte_utils::to_hex_string;
use actix_web::rt::spawn;
use actix_web::web;
use std::fmt::Debug;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::mpsc::UnboundedSender;
use tracing::{debug, info};

pub struct FeedSlotsManager {}

impl FeedSlotsManager {
    pub fn new<
        K: Debug + Clone + std::string::ToString + 'static + std::convert::From<std::string::String>,
        V: Debug + Clone + std::string::ToString + 'static + std::convert::From<std::string::String>,
    >(
        result_send: UnboundedSender<(K, V)>,
        feed: Arc<RwLock<FeedMetaData>>,
        name: String,
        report_interval_ms: u64,
        first_report_start_time: u128,
        app_state_clone: web::Data<FeedsState>,
        key: u32,
    ) -> FeedSlotsManager {
        spawn(async move {
            let feed_slots_time_tracker =
                FeedSlotTimeTracker::new(report_interval_ms, first_report_start_time);

            loop {
                feed_slots_time_tracker.await_end_of_current_slot().await;

                let result_post_to_contract: String;
                let key_post: u32;
                {
                    let current_time_as_ms = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .expect("Time went backwards")
                        .as_millis();

                    let slot = feed.read().unwrap().get_slot(current_time_as_ms);

                    info!(
                        "Processing votes for {} with id {} for slot {} rep_interval {}.",
                        name, key, slot, report_interval_ms
                    );

                    let reports: Arc<RwLock<crate::feeds::feeds_registry::FeedReports>> =
                        match app_state_clone.reports.read().unwrap().get(key) {
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
                    let mut values: Vec<&String> = vec![];
                    for kv in &reports.report {
                        values.push(&kv.1);
                    }

                    if values.is_empty() {
                        info!("No reports found for slot {}!", &slot);
                        continue;
                    }

                    key_post = key;
                    result_post_to_contract = feed.read().unwrap().get_feed_type().process(values); // Dispatch to concreate FeedProcessing implementation.
                    info!("result_post_to_contract = {:?}", result_post_to_contract);
                    reports.clear();
                }

                result_send
                    .send((
                        to_hex_string(key_post.to_be_bytes().to_vec(), None).into(),
                        result_post_to_contract.into(),
                    ))
                    .unwrap();
            }
        });
        FeedSlotsManager {}
    }
}
