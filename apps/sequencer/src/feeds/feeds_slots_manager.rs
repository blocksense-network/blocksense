use crate::feeds::feed_slots_processor::FeedSlotsProcessor;
use crate::sequencer_state::SequencerState;
use actix_web::rt::spawn;
use actix_web::web;
use config::FeedConfig;
use eyre::Result;
use feed_registry::types::{FeedMetaData, FeedsSlotProcessorCmds::Terminate};
use futures::select;
use futures::stream::{FuturesUnordered, StreamExt};
use std::fmt::Debug;
use std::io::Error;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};

#[derive(Debug)]
pub struct RegisterNewAssetFeed {
    pub config: FeedConfig,
}

#[derive(Debug)]
pub struct DeleteAssetFeed {
    pub id: u32,
}

pub enum FeedsSlotsManagerCmds {
    RegisterNewAssetFeed(RegisterNewAssetFeed),
    DeleteAssetFeed(DeleteAssetFeed),
}

pub enum ProcessorResultValue {
    FeedsSlotsManagerCmds(
        Box<FeedsSlotsManagerCmds>,
        mpsc::UnboundedReceiver<FeedsSlotsManagerCmds>,
    ),
    ProcessorExitStatus(String),
}

pub async fn feeds_slots_manager_loop<
    K: Debug + Clone + std::string::ToString + 'static + std::convert::From<std::string::String>,
    V: Debug + Clone + std::string::ToString + 'static + std::convert::From<std::string::String>,
>(
    sequencer_state: web::Data<SequencerState>,
    vote_send: mpsc::UnboundedSender<(K, V)>,
    cmd_channel: mpsc::UnboundedReceiver<FeedsSlotsManagerCmds>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    let reports_clone = sequencer_state.reports.clone();
    spawn(async move {
        let mut collected_futures = FuturesUnordered::new();

        let reg = sequencer_state.registry.read().await;

        let keys = reg.get_keys();

        for key in keys {
            let send_channel: mpsc::UnboundedSender<(K, V)> = vote_send.clone();
            let rc = reports_clone.clone();

            debug!("key = {} : value = {:?}", key, reg.get(key));

            sequencer_state
                .feed_aggregate_history
                .write()
                .await
                .register_feed(key, 10_000); //TODO(snikolov): How to avoid borrow?

            let feed = match reg.get(key) {
                Some(x) => x,
                None => panic!("Error timer for feed that was not registered."),
            };

            let name = feed.read().await.get_name().clone();
            let feed_aggregate_history_cp = sequencer_state.feed_aggregate_history.clone();
            let reporters_cp = sequencer_state.reporters.clone();
            let feed_metrics_cp = sequencer_state.feeds_metrics.clone();

            let feed_slots_processor = FeedSlotsProcessor::new(name, key);

            let (cmd_send, cmd_recv) = mpsc::unbounded_channel();

            feed.write().await.set_processor_cmd_chan(cmd_send);

            collected_futures.push(spawn(async move {
                feed_slots_processor
                    .start_loop(
                        send_channel,
                        feed,
                        rc,
                        feed_aggregate_history_cp,
                        reporters_cp,
                        Some(feed_metrics_cp),
                        cmd_recv,
                        None,
                    )
                    .await
            }));
        }

        collected_futures.push(spawn(async move {
            read_next_feed_slots_manager_cmd(cmd_channel).await
        }));

        drop(reg);

        loop {
            select! {
                future_result = collected_futures.select_next_some() => {
                    let res = match future_result {
                        Ok(res) => res,
                        Err(e) => {
                            // We panic here, because this is a serious error.
                            panic!("JoinError: {e}");
                        },
                    };

                    let processor_result_val = match res {
                        Ok(processor_result_val) => processor_result_val,
                        Err(e) => {
                            // We error here, to support the task returning errors.
                            error!("Task terminated with error: {}", e.to_string());
                            continue;
                        }
                    };

                    handle_feed_slots_processor_result(
                        sequencer_state.clone(),
                        &collected_futures,
                        processor_result_val).await;
                },
                complete => break,
            }
        }
        Ok(())
    })
}

async fn handle_feed_slots_processor_result(
    sequencer_state: web::Data<SequencerState>,
    collected_futures: &FuturesUnordered<
        tokio::task::JoinHandle<std::result::Result<ProcessorResultValue, eyre::Error>>,
    >,
    processor_result_val: ProcessorResultValue,
) {
    match processor_result_val {
        ProcessorResultValue::FeedsSlotsManagerCmds(feeds_slots_manager_cmds, cmd_channel) => {
            handle_feeds_slots_manager_cmd(
                feeds_slots_manager_cmds,
                sequencer_state,
                cmd_channel,
                collected_futures,
            )
            .await;
        }
        ProcessorResultValue::ProcessorExitStatus(msg) => {
            info!("Task complete {}", msg);
        }
    }
}

async fn handle_feeds_slots_manager_cmd(
    feeds_slots_manager_cmds: Box<FeedsSlotsManagerCmds>,
    sequencer_state: web::Data<SequencerState>,
    cmd_channel: mpsc::UnboundedReceiver<FeedsSlotsManagerCmds>,
    collected_futures: &FuturesUnordered<
        tokio::task::JoinHandle<std::result::Result<ProcessorResultValue, eyre::Error>>,
    >,
) {
    match *feeds_slots_manager_cmds {
        FeedsSlotsManagerCmds::RegisterNewAssetFeed(register_new_asset_feed) => {
            match register_asset_feed(&sequencer_state, &register_new_asset_feed).await {
                Ok(registered_feed_metadata) => {
                    let new_name = register_new_asset_feed.config.name;
                    let new_id = register_new_asset_feed.config.id;
                    let feed_slots_processor = FeedSlotsProcessor::new(new_name, new_id);
                    let (cmd_send, cmd_recv) = mpsc::unbounded_channel();

                    {
                        let reg = sequencer_state.registry.read().await;
                        let feed = match reg.get(new_id) {
                            Some(x) => x,
                            None => panic!("Error feed was not registered."),
                        };
                        feed.write().await.set_processor_cmd_chan(cmd_send);
                    }

                    collected_futures.push(spawn(async move {
                        feed_slots_processor
                            .start_loop(
                                sequencer_state.voting_send_channel.clone(),
                                registered_feed_metadata,
                                sequencer_state.reports.clone(),
                                sequencer_state.feed_aggregate_history.clone(),
                                sequencer_state.reporters.clone(),
                                Some(sequencer_state.feeds_metrics.clone()),
                                cmd_recv,
                                None,
                            )
                            .await
                    }));
                    info!("Registering feed id {new_id} complete!");
                }
                Err(e) => {
                    error!("{}", e);
                }
            };
        }
        FeedsSlotsManagerCmds::DeleteAssetFeed(delete_asset_feed) => {
            {
                let reg = sequencer_state.registry.read().await;
                let feed = match reg.get(delete_asset_feed.id) {
                    Some(x) => x,
                    None => panic!("Error feed was not registered."),
                };

                let _ = match &feed.read().await.processor_cmd_chan {
                    Some(chan) => {
                        match chan.send(Terminate()) {
                            Ok(_) => {
                                debug!(
                                    "Feeds manager sent Terminate cmd to processor for feed id {}",
                                    delete_asset_feed.id
                                );
                            }
                            Err(e) => {
                                error!(
                                    "Error sending to processot for feed id {}: {:?}",
                                    delete_asset_feed.id, e
                                );
                            }
                        };
                    }
                    None => {
                        error!("No channel for feed {} management!", delete_asset_feed.id)
                    }
                };
            }
            match deregister_asset_feed(&sequencer_state, &delete_asset_feed).await {
                Ok(_) => {
                    info!("Delete asset feed {delete_asset_feed:?} complete!");
                }
                Err(e) => {
                    warn!("Failed to deregister asset feed {delete_asset_feed:?}: {e}");
                }
            };
        }
    };
    //Register reader task again once the command is processed
    collected_futures.push(spawn(async move {
        read_next_feed_slots_manager_cmd(cmd_channel).await
    }));
}

async fn register_asset_feed(
    sequencer_state: &web::Data<SequencerState>,
    cmd: &RegisterNewAssetFeed,
) -> Result<Arc<RwLock<FeedMetaData>>> {
    let new_feed_config = &cmd.config;
    let new_feed_id;
    let new_name;
    {
        let mut reg = sequencer_state.registry.write().await;

        let keys = reg.get_keys();

        new_feed_id = new_feed_config.id;
        new_name = new_feed_config.name.clone();

        if keys.contains(&new_feed_id) {
            eyre::bail!("Cannot register feed ID, feed with this ID {new_feed_id} already exists.");
        }

        let new_feed_metadata = FeedMetaData::new(
            &new_name,
            new_feed_config.report_interval_ms,
            new_feed_config.quorum_percentage,
            new_feed_config.first_report_start_time,
            new_feed_config.value_type.clone(),
            new_feed_config.aggregate_type.clone(),
            None,
        );
        reg.push(new_feed_id, new_feed_metadata);
    }
    {
        let mut active_feeds = sequencer_state.active_feeds.write().await;
        active_feeds.insert(new_feed_config.id, new_feed_config.clone());
    }
    {
        let registered_feed_metadata = sequencer_state
            .registry
            .read()
            .await
            .get(new_feed_id)
            .unwrap();

        // update feeds slots processor
        sequencer_state
            .feed_aggregate_history
            .write()
            .await
            .register_feed(new_feed_id, 10_000); //TODO(snikolov): How to avoid borrow?

        Ok(registered_feed_metadata)
    }
}

async fn deregister_asset_feed(
    sequencer_state: &web::Data<SequencerState>,
    cmd: &DeleteAssetFeed,
) -> Result<()> {
    let feed_id = cmd.id;
    {
        let mut reg = sequencer_state.registry.write().await;

        let keys = reg.get_keys();

        if !keys.contains(&feed_id) {
            eyre::bail!("Cannot deregister feed ID, feed with this ID {feed_id} does not exists.");
        }

        reg.remove(feed_id);
    }
    {
        let mut active_feeds = sequencer_state.active_feeds.write().await;
        active_feeds.remove(&feed_id);
    }

    sequencer_state
        .feed_aggregate_history
        .write()
        .await
        .deregister_feed(feed_id);

    Ok(())
}

async fn read_next_feed_slots_manager_cmd(
    mut cmd_channel: mpsc::UnboundedReceiver<FeedsSlotsManagerCmds>,
) -> Result<ProcessorResultValue> {
    loop {
        let cmd = cmd_channel.recv().await;
        if let Some(cmd) = cmd {
            return Ok(ProcessorResultValue::FeedsSlotsManagerCmds(
                Box::new(cmd),
                cmd_channel,
            ));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::provider::init_shared_rpc_providers;
    use crate::reporters::reporter::init_shared_reporters;
    use config::get_sequencer_and_feed_configs;
    use config::init_config;
    use config::SequencerConfig;
    use data_feeds::feeds_processing::naive_packing;
    use feed_registry::registry::FeedAggregateHistory;
    use feed_registry::registry::{new_feeds_meta_data_reg_from_config, AllFeedsReports};
    use feed_registry::types::{FeedResult, FeedType};
    use prometheus::metrics::FeedsMetrics;
    use std::env;
    use std::path::PathBuf;
    use std::sync::Arc;
    use std::time::Duration;

    use tokio::sync::RwLock;
    use utils::logging::init_shared_logging_handle;
    use utils::to_hex_string;

    #[actix_web::test]
    async fn test_feed_slots_manager_loop() {
        let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let sequencer_config_file = PathBuf::new()
            .join(manifest_dir)
            .join("tests")
            .join("sequencer_config.json");

        let log_handle = init_shared_logging_handle("INFO", false);
        let sequencer_config =
            init_config::<SequencerConfig>(&sequencer_config_file).expect("Failed to load config:");

        let (_, mut feeds_config) = get_sequencer_and_feed_configs();

        let all_feeds_reports = AllFeedsReports::new();
        let all_feeds_reports_arc = Arc::new(RwLock::new(all_feeds_reports));
        let metrics_prefix = Some("test_feed_slots_manager_loop_");

        let providers = init_shared_rpc_providers(&sequencer_config, metrics_prefix).await;

        let original_report_data = FeedType::Numerical(13.0);

        // we are specifically sending only one report message as we don't want to test the average processor
        const TIME_INTERVAL: u64 = 2000;

        feeds_config.feeds[1].report_interval_ms = TIME_INTERVAL; // lower the report time interval.

        let reporter_id = 42;
        all_feeds_reports_arc
            .write()
            .await
            .push(
                1,
                reporter_id,
                FeedResult::Result {
                    result: original_report_data.clone(),
                },
            )
            .await;
        let (vote_send, mut vote_recv) = mpsc::unbounded_channel();
        let (feeds_slots_manager_cmd_send, feeds_slots_manager_cmd_recv) =
            mpsc::unbounded_channel();

        let sequencer_state = web::Data::new(SequencerState {
            registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_from_config(
                &feeds_config,
            ))),
            reports: all_feeds_reports_arc,
            providers,
            log_handle,
            reporters: init_shared_reporters(&sequencer_config, metrics_prefix),
            feed_id_allocator: Arc::new(RwLock::new(None)),
            voting_send_channel: vote_send.clone(),
            feeds_metrics: Arc::new(RwLock::new(
                FeedsMetrics::new(metrics_prefix.expect("Need to set metrics prefix in tests!"))
                    .expect("Failed to allocate feed_metrics"),
            )),
            active_feeds: Arc::new(RwLock::new(
                feeds_config
                    .feeds
                    .into_iter()
                    .map(|feed| (feed.id, feed))
                    .collect(),
            )),
            sequencer_config: Arc::new(RwLock::new(sequencer_config.clone())),
            feed_aggregate_history: Arc::new(RwLock::new(FeedAggregateHistory::new())),
            feeds_slots_manager_cmd_send,
        });

        let _future = feeds_slots_manager_loop(
            sequencer_state,
            vote_send.clone(),
            feeds_slots_manager_cmd_recv,
        )
        .await;

        // Attempt to receive with a timeout of 2 seconds
        let received = tokio::time::timeout(
            Duration::from_millis(TIME_INTERVAL + 1000),
            vote_recv.recv(),
        )
        .await;

        match received {
            Ok(Some((key, result))) => {
                // assert the received data
                assert_eq!(
                    key,
                    to_hex_string((1 as u32).to_be_bytes().to_vec(), None),
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
