use crate::feeds::feed_slots_processor::FeedSlotsProcessor;
use crate::sequencer_state::SequencerState;
use actix_web::web;
use blocksense_feed_registry::feed_registration_cmds::{
    DeleteAssetFeed, FeedsManagementCmds, ProcessorResultValue, RegisterNewAssetFeed,
};
use blocksense_feed_registry::types::{FeedMetaData, FeedsSlotProcessorCmds::Terminate};
use blocksense_registry::config::FeedConfig;
use eyre::Result;
use futures::select;
use futures::stream::{FuturesUnordered, StreamExt};
use std::io::Error;
use std::sync::Arc;
use std::time::Duration;
use std::time::UNIX_EPOCH;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};

pub async fn feeds_slots_manager_loop(
    sequencer_state: web::Data<SequencerState>,
    cmd_channel: mpsc::UnboundedReceiver<FeedsManagementCmds>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("feeds_slots_manager")
        .spawn(async move {
            let mut collected_futures = FuturesUnordered::new();

            let reg = sequencer_state.registry.read().await;

            let keys = reg.get_keys();

            for key in keys {
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
                let feed_metrics_cp = sequencer_state.feeds_metrics.clone();

                let feed_slots_processor = FeedSlotsProcessor::new(name, key);

                let (cmd_send, cmd_recv) = mpsc::unbounded_channel();

                feed.write().await.set_processor_cmd_chan(cmd_send);

                let sequencer_state = sequencer_state.clone();
                collected_futures.push(
                    tokio::task::Builder::new()
                        .name(format!("feed_processor_{key}").as_str())
                        .spawn(async move {
                            feed_slots_processor
                                .start_loop(
                                    &sequencer_state,
                                    &feed,
                                    &feed_aggregate_history_cp,
                                    Some(feed_metrics_cp),
                                    cmd_recv,
                                    None,
                                )
                                .await
                        })
                        .expect("Failed to spawn processor for feed {key}!"),
                );
            }

            collected_futures.push(
                tokio::task::Builder::new()
                    .name("fsm_command_watcher")
                    .spawn(async move { read_next_feed_slots_manager_cmd(cmd_channel).await })
                    .expect("Failed to spawn feed slots manager command watcher!"),
            );

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
        .expect("Failed to spawn feed slots manager!")
}

async fn handle_feed_slots_processor_result(
    sequencer_state: web::Data<SequencerState>,
    collected_futures: &FuturesUnordered<
        tokio::task::JoinHandle<std::result::Result<ProcessorResultValue, eyre::Error>>,
    >,
    processor_result_val: ProcessorResultValue,
) {
    match processor_result_val {
        ProcessorResultValue::FeedsManagementCmds(feeds_slots_manager_cmds, cmd_channel) => {
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
    feeds_slots_manager_cmds: Box<FeedsManagementCmds>,
    sequencer_state: web::Data<SequencerState>,
    cmd_channel: mpsc::UnboundedReceiver<FeedsManagementCmds>,
    collected_futures: &FuturesUnordered<
        tokio::task::JoinHandle<std::result::Result<ProcessorResultValue, eyre::Error>>,
    >,
) {
    match *feeds_slots_manager_cmds {
        FeedsManagementCmds::RegisterNewAssetFeed(register_new_asset_feed) => {
            match register_asset_feed(&sequencer_state, &register_new_asset_feed).await {
                Ok(registered_feed_metadata) => {
                    let new_name = register_new_asset_feed.config.full_name;
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

                    let sequencer_state = sequencer_state.clone();
                    let processor_future = tokio::task::Builder::new()
                        .name(format!("dynamic_feed_processor_{new_id}").as_str())
                        .spawn(async move {
                            let feed_aggregate_history =
                                sequencer_state.feed_aggregate_history.clone();
                            let feeds_metrics = sequencer_state.feeds_metrics.clone();
                            feed_slots_processor
                                .start_loop(
                                    &sequencer_state,
                                    &registered_feed_metadata,
                                    &feed_aggregate_history,
                                    Some(feeds_metrics),
                                    cmd_recv,
                                    None,
                                )
                                .await
                        });
                    match processor_future {
                        Ok(processor_future) => collected_futures.push(processor_future),
                        Err(err) => error!(
                            "Failed to spawn dynamic processor for feed {new_id} due to {err}"
                        ),
                    };
                    info!("Registering feed id {new_id} complete!");
                }
                Err(e) => {
                    error!("{e}");
                }
            };
        }
        FeedsManagementCmds::DeleteAssetFeed(delete_asset_feed) => {
            {
                let reg = sequencer_state.registry.read().await;
                let feed = match reg.get(delete_asset_feed.id) {
                    Some(x) => x,
                    None => panic!("Error feed was not registered."),
                };

                match &feed.read().await.processor_cmd_chan {
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
                                    "Error sending to processor for feed id {}: {:?}",
                                    delete_asset_feed.id, e
                                );
                            }
                        };
                    }
                    None => error!("No channel for feed {} management!", delete_asset_feed.id),
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
    let command_watcher = tokio::task::Builder::new()
        .name("restarted_fsm_command_watcher")
        .spawn(async move { read_next_feed_slots_manager_cmd(cmd_channel).await });
    match command_watcher {
        Ok(command_watcher) => collected_futures.push(command_watcher),
        Err(err) => {
            error!("Failed to spawn restarted feed slots manager command watcher due to {err}")
        }
    };
}

async fn register_asset_feed(
    sequencer_state: &web::Data<SequencerState>,
    cmd: &RegisterNewAssetFeed,
) -> Result<Arc<RwLock<FeedMetaData>>> {
    let new_feed_config = &cmd.config;
    register_feed_with_config(sequencer_state, new_feed_config).await
}

pub async fn register_feed_with_config(
    sequencer_state: &web::Data<SequencerState>,
    new_feed_config: &FeedConfig,
) -> Result<Arc<RwLock<FeedMetaData>>> {
    let new_feed_id;
    let new_name;
    {
        let mut reg = sequencer_state.registry.write().await;

        let keys = reg.get_keys();

        new_feed_id = new_feed_config.id;
        new_name = new_feed_config.full_name.clone();

        if keys.contains(&new_feed_id) {
            eyre::bail!("Cannot register feed ID, feed with this ID {new_feed_id} already exists.");
        }

        let new_feed_metadata = FeedMetaData::new(
            new_name,
            new_feed_config.schedule.interval_ms,
            new_feed_config.quorum.percentage,
            new_feed_config.schedule.deviation_percentage,
            new_feed_config.schedule.heartbeat_ms,
            UNIX_EPOCH
                + Duration::from_millis(new_feed_config.schedule.first_report_start_unix_time_ms),
            new_feed_config.value_type.clone(),
            new_feed_config.quorum.aggregation.clone(),
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
    mut cmd_channel: mpsc::UnboundedReceiver<FeedsManagementCmds>,
) -> Result<ProcessorResultValue> {
    loop {
        debug!("Waiting for command...");
        let cmd = cmd_channel.recv().await;
        if let Some(cmd) = cmd {
            return Ok(ProcessorResultValue::FeedsManagementCmds(
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
    use blocksense_config::{test_feed_config, AllFeedsConfig, SequencerConfig};
    use blocksense_feed_registry::types::{test_payload_from_result, FeedType};
    use std::{collections::HashMap, time::Duration};

    use blocksense_config::get_test_config_with_no_providers;

    use crate::feeds::feed_slots_processor::tests::check_received;
    use blocksense_utils::logging::init_shared_logging_handle;

    #[actix_web::test]
    async fn test_feed_slots_manager_loop() {
        let log_handle = init_shared_logging_handle("INFO", false);
        let sequencer_config: SequencerConfig = get_test_config_with_no_providers();
        let mut feed_1_config = test_feed_config(1, 0);
        const TIME_INTERVAL: u64 = 2_000_u64;

        feed_1_config.schedule.interval_ms = TIME_INTERVAL; // lower the report time interval.
        let feeds_config = AllFeedsConfig {
            feeds: vec![feed_1_config],
        };
        let metrics_prefix = Some("test_feed_slots_manager_loop_");

        let providers =
            init_shared_rpc_providers(&sequencer_config, metrics_prefix, &feeds_config).await;

        let original_report_data = FeedType::Numerical(13.0);

        // we are specifically sending only one report message as we don't want to test the average processor
        let reporter_id = 42;
        let (vote_send, mut vote_recv) = mpsc::unbounded_channel();
        let (
            feeds_management_cmd_to_block_creator_send,
            feeds_management_cmd_to_block_creator_recv,
        ) = mpsc::unbounded_channel();
        let (feeds_slots_manager_cmd_send, _feeds_slots_manager_cmd_recv) =
            mpsc::unbounded_channel();
        let (aggregate_batch_sig_send, _aggregate_batch_sig_recv) = mpsc::unbounded_channel();

        let sequencer_state = web::Data::new(SequencerState::new(
            feeds_config,
            providers,
            log_handle,
            &sequencer_config,
            metrics_prefix,
            None,
            vote_send,
            feeds_management_cmd_to_block_creator_send,
            feeds_slots_manager_cmd_send,
            aggregate_batch_sig_send,
            Arc::new(RwLock::new(HashMap::new())),
        ));

        sequencer_state
            .reports
            .write()
            .await
            .push(
                1,
                reporter_id,
                test_payload_from_result(Ok(original_report_data.clone())),
            )
            .await;

        let _future =
            feeds_slots_manager_loop(sequencer_state, feeds_management_cmd_to_block_creator_recv)
                .await;

        // Attempt to receive with a timeout of 2 seconds
        let received = tokio::time::timeout(
            Duration::from_millis(TIME_INTERVAL + 1000),
            vote_recv.recv(),
        )
        .await;
        check_received(received, (1_u32, original_report_data));
    }
}
