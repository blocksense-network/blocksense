use crate::providers::eth_send_utils::{
    eth_batch_send_to_all_contracts, get_serialized_updates_for_network,
};
use crate::{sequencer_state::SequencerState, UpdateToSend};
use actix_web::web::Data;
use alloy::hex;
use feed_registry::types::Repeatability::Periodic;
use rdkafka::producer::FutureRecord;
use rdkafka::util::Timeout;
use serde_json::json;
use std::io::Error;
use std::time::Duration;
use tokio::sync::mpsc::UnboundedReceiver;
use tracing::{debug, error, info, warn};

pub async fn votes_result_sender_loop(
    mut batched_votes_recv: UnboundedReceiver<UpdateToSend>,
    sequencer_state: Data<SequencerState>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("votes_result_sender")
        .spawn_local(async move {
            let mut batch_count = 0;
            loop {
                let recvd = batched_votes_recv.recv().await;
                match recvd {
                    Some(updates) => {
                        try_send_aggregation_consensus_trigger_to_reporters(
                            &sequencer_state,
                            &updates,
                        )
                        .await;

                        info!("sending updates to contract:");
                        let sequencer_state = sequencer_state.clone();
                        async_send_to_contracts(sequencer_state, updates, batch_count);
                    }
                    None => {
                        panic!("Sender got RecvError"); // This error indicates a severe internal error.
                    }
                }
                batch_count += 1;
                if batch_count >= 1000000 {
                    batch_count = 0;
                }
            }
        })
        .expect("Failed to spawn votes result sender!")
}

fn async_send_to_contracts(
    sequencer_state: Data<SequencerState>,
    updates: UpdateToSend,
    batch_count: usize,
) {
    let sender = tokio::task::Builder::new()
        .name(format!("batch_sender_{batch_count}").as_str())
        .spawn_local(async move {
            match eth_batch_send_to_all_contracts(sequencer_state, updates, Periodic).await {
                Ok(res) => info!("Sending updates complete {}.", res),
                Err(err) => error!("ERROR Sending updates {}", err),
            };
        });
    if let Err(err) = sender {
        error!("Failed to spawn batch sender {batch_count} due to {err}!");
    }
}

async fn try_send_aggregation_consensus_trigger_to_reporters(
    sequencer_state: &Data<SequencerState>,
    updates: &UpdateToSend,
) {
    if let Some(kafka_endpoint) = &sequencer_state.kafka_endpoint {
        let block_height = updates.block_height;
        let sequencer_id = sequencer_state.sequencer_config.read().await.sequencer_id;

        let providers = sequencer_state.providers.read().await;

        // iterate for all supported networks and generate a calldata for the contract accordingly
        for (net, p) in providers.iter() {
            // Do not hold the provider_settings lock for more than necessary
            let provider_settings = {
                let providers_config = sequencer_state.sequencer_config.read().await;
                let providers_config = &providers_config.providers;

                let Some(provider_settings) = providers_config.get(net).cloned() else {
                    warn!(
                        "Network `{net}` is not configured in sequencer; skipping it during second round consensus"
                    );
                    continue;
                };

                if !provider_settings.is_enabled {
                    warn!("Network `{net}` is not enabled; skipping it for second round consensus");
                    continue;
                } else {
                    info!("Network `{net}` is enabled; initiating second round consensus");
                }
                provider_settings
            };

            let feeds_metrics = sequencer_state.feeds_metrics.clone();
            let feeds_config = sequencer_state.active_feeds.clone();

            let serialized_updates = match get_serialized_updates_for_network(
                net,
                p,
                updates.clone(),
                &provider_settings,
                Some(feeds_metrics),
                feeds_config,
            )
            .await
            {
                Ok((res, _, _)) => res,
                Err(e) => {
                    warn!("Could not get serialized updates for network {net} due to: {e}");
                    continue;
                }
            };

            let updates_to_kafka = json!({
                "SequencerId": sequencer_id,
                "BlockHeight": block_height,
                "Network": net,
                "calldata": hex::encode(serialized_updates),
            });

            match kafka_endpoint
                .send(
                    FutureRecord::<(), _>::to("aggregation_consensus")
                        .payload(&updates_to_kafka.to_string()),
                    Timeout::After(Duration::from_secs(3 * 60)),
                )
                .await
            {
                Ok(res) => debug!(
                    "Successfully sent batch of aggregated feed values to kafka endpoint: {res:?}"
                ),
                Err(e) => error!(
                    "Failed to send batch of aggregated feed values to kafka endpoint! {e:?}"
                ),
            }
        }
    } else {
        warn!("No Kafka endpoint set to stream consensus second round data.");
    }
}
