use actix_web::{rt::time, web::Data};
use std::fmt::Debug;
use std::{collections::HashMap, io::Error};
use tokio::time::Duration;

use crate::sequencer_state::SequencerState;
use serde_json::json;
use tokio::sync::mpsc;
use tracing::{error, info, trace};

#[derive(Debug)]
pub struct TriggerBatchConsensus {
    updates: HashMap<String, String>,
}

#[allow(clippy::large_enum_variant)]
pub enum AggregatedResultsConsensusCmds {
    TriggerBatchConsensus(TriggerBatchConsensus),
}

pub async fn aggregated_results_consensus_manager_loop(
    sequencer_state: Data<SequencerState>,
    mut cmd_channel: mpsc::UnboundedReceiver<AggregatedResultsConsensusCmds>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("aggregated_results_consensus_manager")
        .spawn_local(async move {
            loop {
                info!("Starting aggregated_results_consensus_manager loop ...");
                let mut interval = time::interval(Duration::from_millis(60000));
                interval.tick().await;

                tokio::select! {
                    _ = interval.tick() => {
                        println!("aggregated_results_consensus_manager_loop tick");
                    }

                    opt_cmd = cmd_channel.recv() => {
                        match opt_cmd {
                            Some(cmd) => {
                                match cmd {
                                    AggregatedResultsConsensusCmds::TriggerBatchConsensus(trigger_batch_consensus) => {
                                        // Stream the batch of feed value updates for second round of consensus
                                        // let safe_tx_to_kafka = json!({
                                        //     "sequencer_id": sequencer_id,
                                        //     "contract_address": "",
                                        //     "batch_keys_vals": "",
                                        //     "safe_address": "",
                                        //     "nonce": ""
                                        // });
                                        // match kafka_endpoint
                                        //     .send(
                                        //         FutureRecord::<(), _>::to("consensus").payload(&safe_tx_to_kafka.to_string()),
                                        //         Timeout::Never,
                                        //     )
                                        //     .await
                                        // {
                                        //     Ok(res) => {
                                        //         debug!("Successfully sent a batch for consensus to kafka endpoint: {res:?}")
                                        //     }
                                        //     Err(e) => error!("Failed to send to kafka endpoint! {e:?}"),
                                        // }
                                    },
                                }
                            },
                            None => {

                            },
                        }
                    }
                }
            }
        })
        .expect("Failed to spawn aggregated_results_consensus_manager loop!")
}
