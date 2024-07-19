use crate::feeds::feed_slots_processor::feed_slots_processor_loop;
use crate::feeds::feeds_registry::FeedAggregateHistory;
use crate::feeds::feeds_state::FeedsState;
use actix_web::rt::spawn;
use actix_web::web;
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
            let report_interval_ms = feed.read().expect(lock_err_msg).get_report_interval_ms();
            let first_report_start_time = feed
                .read()
                .expect(lock_err_msg)
                .get_first_report_start_time_ms();

            let feed_aggregate_history_cp = feed_aggregate_history.clone();

            collected_futures.push(spawn(async move {
                feed_slots_processor_loop(
                    send_channel,
                    feed,
                    name,
                    report_interval_ms,
                    first_report_start_time,
                    rc,
                    feed_aggregate_history_cp,
                    key,
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
    use crate::feeds::feeds_registry::{new_feeds_meta_data_reg_from_config, AllFeedsReports};
    use crate::plugin_registry;
    use crate::providers::provider::init_shared_rpc_providers;
    use crate::reporters::reporter::init_shared_reporters;
    use crate::utils::logging::init_shared_logging_handle;
    use actix_web::{http::header::ContentType, test, App};
    use data_feeds::feeds_processing::naive_packing;
    use data_feeds::types::FeedType;
    use std::env;
    use std::path::PathBuf;
    use std::sync::{Arc, RwLock};
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use tokio::sync::mpsc::unbounded_channel;
    use utils::to_hex_string;

    #[actix_web::test]
    async fn test_feed_slots_manager_loop() {
        let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let tests_dir_path = PathBuf::new().join(manifest_dir).join("tests");
        env::set_var("SEQUENCER_CONFIG_DIR", tests_dir_path);
        let log_handle = init_shared_logging_handle();
        let sequencer_config = init_sequencer_config();
        let all_feeds_reports = AllFeedsReports::new();
        let all_feeds_reports_arc = Arc::new(RwLock::new(all_feeds_reports));
        let providers = init_shared_rpc_providers(&sequencer_config).await;

        let original_report_data = FeedType::Numerical(13.0);

        // we are specifically sending only one report message as we don't want to test the average processor
        let feed_id = 1;
        let reporter_id = 42;
        all_feeds_reports_arc.write().unwrap().push(
            feed_id,
            reporter_id,
            original_report_data.clone(),
        );

        let app_state = web::Data::new(FeedsState {
            registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_from_config(
                &sequencer_config,
            ))),
            reports: all_feeds_reports_arc,
            plugin_registry: Arc::new(RwLock::new(plugin_registry::CappedHashMap::new())),
            providers: providers.clone(),
            log_handle,
            reporters: init_shared_reporters(&sequencer_config),
        });

        let (tx, mut rx) = unbounded_channel::<(String, String)>();

        let future = feeds_slots_manager_loop(app_state, tx).await;

        // Attempt to receive with a timeout of 2 seconds
        let received = tokio::time::timeout(Duration::from_secs(60), rx.recv()).await;

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
