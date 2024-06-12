use crate::feeds::feed_slots_processor::feed_slots_processor_loop;
use crate::feeds::feeds_state::FeedsState;
use actix_web::rt::spawn;
use actix_web::web;
use eyre::Report;
use futures::stream::FuturesUnordered;
use std::fmt::Debug;
use tokio::sync::mpsc;
use tracing::debug;
use tracing::error;

pub struct FeedsSlotsManager {}

impl FeedsSlotsManager {
    pub fn new<
        K: Debug + Clone + std::string::ToString + 'static + std::convert::From<std::string::String>,
        V: Debug + Clone + std::string::ToString + 'static + std::convert::From<std::string::String>,
    >(
        app_state: web::Data<FeedsState>,
        vote_send: mpsc::UnboundedSender<(K, V)>,
    ) -> FeedsSlotsManager {
        let reports_clone = app_state.reports.clone();
        spawn(async move {
            let collected_futures: FuturesUnordered<
                tokio::task::JoinHandle<std::prelude::v1::Result<String, Report>>,
            > = FuturesUnordered::new();

            let reg = app_state
                .registry
                .write()
                .expect("Could not lock all feeds meta data registry.");
            let keys = reg.get_keys();
            for key in keys {
                let send_channel: mpsc::UnboundedSender<(K, V)> = vote_send.clone();
                let rc = reports_clone.clone();

                debug!("key = {} : value = {:?}", key, reg.get(key));

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

                collected_futures.push(spawn(
                    async move {
                        feed_slots_processor_loop(
                            send_channel,
                            feed,
                            name,
                            report_interval_ms,
                            first_report_start_time,
                            rc,
                            key,
                        )
                    }
                    .await,
                ));
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
                        all_results += &e.to_string()
                    }
                }
                all_results += " "
            }
        });
        FeedsSlotsManager {}
    }
}
