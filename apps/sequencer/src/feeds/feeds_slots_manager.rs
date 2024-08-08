use crate::feeds::feed_slots_processor::feed_slots_processor_loop;
use crate::feeds::feeds_state::FeedsState;
use actix_web::rt::spawn;
use actix_web::web;
use feed_registry::registry::FeedAggregateHistory;
use futures::stream::FuturesUnordered;
use std::fmt::Debug;
use std::io::Error;
use std::sync::Arc;
use std::sync::RwLock;
use tokio::sync::mpsc;
use tracing::debug;
use tracing::error;

pub async fn feeds_slots_manager_loop<
    K: Debug + Clone + std::string::ToString + 'static + std::convert::From<std::string::String>,
    V: Debug + Clone + std::string::ToString + 'static + std::convert::From<std::string::String>,
>(
    app_state: web::Data<FeedsState>,
    vote_send: mpsc::UnboundedSender<(K, V)>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    let reports_clone = app_state.reports.clone();
    spawn(async move {
        let collected_futures = FuturesUnordered::new();

        let reg = app_state
            .registry
            .write()
            .expect("Could not lock all feeds meta data registry.");

        let keys = reg.get_keys();

        let feed_aggregate_history: Arc<RwLock<FeedAggregateHistory>> =
            Arc::new(RwLock::new(FeedAggregateHistory::new()));

        for key in keys {
            let send_channel: mpsc::UnboundedSender<(K, V)> = vote_send.clone();
            let rc = reports_clone.clone();

            debug!("key = {} : value = {:?}", key, reg.get(key));

            feed_aggregate_history
                .write()
                .unwrap()
                .register_feed(key.clone(), 10_000); //TODO(snikolov): How to avoid borrow?

            let feed = match reg.get(key) {
                Some(x) => x,
                None => panic!("Error timer for feed that was not registered."),
            };

            let lock_err_msg = "Could not lock feed meta data registry for read";
            let name = feed.read().expect(lock_err_msg).get_name().clone();
            let feed_aggregate_history_cp = feed_aggregate_history.clone();
            let reporters_cp = app_state.reporters.clone();
            let feed_metrics_cp = app_state.feeds_metrics.clone();

            collected_futures.push(spawn(async move {
                feed_slots_processor_loop(
                    send_channel,
                    feed,
                    name,
                    rc,
                    feed_aggregate_history_cp,
                    key,
                    reporters_cp,
                    Some(feed_metrics_cp),
                )
                .await
            }));
        }
        drop(reg);
        let result = futures::future::join_all(collected_futures).await;
        let mut all_results = String::new();
        for v in result {
            match v {
                Ok(res) => {
                    all_results += &match res {
                        Ok(x) => x,
                        Err(e) => {
                            let err = "ReportError:".to_owned() + &e.to_string();
                            error!(err);
                            err
                        }
                    }
                }
                Err(e) => {
                    all_results += "JoinError:";
                    all_results += &e.to_string();
                }
            }
            all_results += " "
        }
        Ok({})
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::config::init_sequencer_config;
    use crate::providers::provider::init_shared_rpc_providers;
    use crate::reporters::reporter::init_shared_reporters;
    use data_feeds::feeds_processing::naive_packing;
    use feed_registry::registry::{
        init_feeds_config, new_feeds_meta_data_reg_from_config, AllFeedsReports,
    };
    use feed_registry::types::{FeedResult, FeedType};
    use prometheus::metrics::FeedsMetrics;
    use std::env;
    use std::path::PathBuf;
    use std::sync::{Arc, RwLock};
    use std::time::Duration;

    use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
    use utils::logging::init_shared_logging_handle;
    use utils::to_hex_string;

    #[actix_web::test]
    async fn test_feed_slots_manager_loop() {
        let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let tests_dir_path = PathBuf::new().join(manifest_dir).join("tests");
        env::set_var("SEQUENCER_CONFIG_DIR", tests_dir_path);
        let log_handle = init_shared_logging_handle();
        let sequencer_config = init_sequencer_config().expect("Failed to load config:");
        let feeds_config = init_feeds_config();
        let all_feeds_reports = AllFeedsReports::new();
        let all_feeds_reports_arc = Arc::new(RwLock::new(all_feeds_reports));
        let metrics_prefix = Some("test_feed_slots_manager_loop_");

        let providers = init_shared_rpc_providers(&sequencer_config, metrics_prefix).await;

        let original_report_data = FeedType::Numerical(13.0);

        // we are specifically sending only one report message as we don't want to test the average processor
        let feed_id = 1;
        let reporter_id = 42;
        all_feeds_reports_arc.write().unwrap().push(
            feed_id,
            reporter_id,
            FeedResult::Result {
                result: original_report_data.clone(),
            },
        );
        let (vote_send, mut vote_recv): (
            UnboundedSender<(String, String)>,
            UnboundedReceiver<(String, String)>,
        ) = mpsc::unbounded_channel();
        let app_state = web::Data::new(FeedsState {
            registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_from_config(
                &feeds_config,
            ))),
            reports: all_feeds_reports_arc,
            providers: providers.clone(),
            log_handle,
            reporters: init_shared_reporters(&sequencer_config, metrics_prefix),
            feed_id_allocator: Arc::new(RwLock::new(None)),
            voting_send_channel: vote_send.clone(),
            feeds_metrics: Arc::new(RwLock::new(
                FeedsMetrics::new(metrics_prefix.expect("Need to set metrics prefix in tests!"))
                    .expect("Failed to allocate feed_metrics"),
            )),
        });

        let _future = feeds_slots_manager_loop(app_state, vote_send.clone()).await;

        // Attempt to receive with a timeout of 2 seconds
        let received = tokio::time::timeout(Duration::from_secs(60), vote_recv.recv()).await;

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
}
