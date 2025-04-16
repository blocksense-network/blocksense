use crate::providers::eth_send_utils::{
    eth_batch_send_to_all_contracts, get_serialized_updates_for_network,
};
use crate::sequencer_state::SequencerState;
use actix_web::web::Data;
use alloy::hex::{self, ToHexExt};
use alloy::providers::Provider;
use alloy_primitives::map::HashMap;
use alloy_primitives::{Address, Bytes, U256};
use blocksense_data_feeds::feeds_processing::BatchedAggegratesToSend;
use blocksense_feed_registry::types::Repeatability::Periodic;
use blocksense_gnosis_safe::data_types::ConsensusSecondRoundBatch;
use blocksense_gnosis_safe::utils::{create_safe_tx, generate_transaction_hash, SafeMultisig};
use blocksense_config::{ADFS_CONTRACT_NAME, GNOSIS_SAFE_CONTRACT_NAME, HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME};
use rdkafka::producer::FutureRecord;
use rdkafka::util::Timeout;
use std::io::Error;
use std::time::Duration;
use tokio::sync::mpsc::UnboundedReceiver;
use tracing::{debug, error, info, warn};

pub async fn votes_result_sender_loop(
    mut batched_votes_recv: UnboundedReceiver<BatchedAggegratesToSend>,
    sequencer_state: Data<SequencerState>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("votes_result_sender")
        .spawn_local(async move {
            let mut batch_count = 0;
            loop {
                debug!("Awaiting batched votes over `batched_votes_recv`...");
                let recvd = batched_votes_recv.recv().await;
                debug!(
                    "Received batched votes over `batched_votes_recv`; batch_count={batch_count}"
                );
                match recvd {
                    Some(updates) => {
                        debug!("sending aggregation consensus trigger");
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
    updates: BatchedAggegratesToSend,
    batch_count: usize,
) {
    let sender = tokio::task::Builder::new()
        .name(format!("batch_sender_{batch_count}").as_str())
        .spawn_local(async move {
            debug!("Spawned batch_sender_{batch_count}");
            match eth_batch_send_to_all_contracts(sequencer_state, updates, Periodic).await {
                Ok(res) => info!("Sending updates complete {res}."),
                Err(err) => error!("ERROR Sending updates {err}"),
            };
        });
    if let Err(err) = sender {
        error!("Failed to spawn batch sender {batch_count} due to {err}!");
    }
}

async fn try_send_aggregation_consensus_trigger_to_reporters(
    sequencer_state: &Data<SequencerState>,
    updates: &BatchedAggegratesToSend,
) {
    let Some(kafka_endpoint) = &sequencer_state.kafka_endpoint else {
        warn!("No Kafka endpoint set to stream consensus second round data.");
        return;
    };
    let block_height = updates.block_height;
    let sequencer_id = sequencer_state.sequencer_config.read().await.sequencer_id;

    let providers = sequencer_state.providers.read().await;

    // iterate for all supported networks and generate a calldata for the contract accordingly
    for (net, provider) in providers.iter() {
        // Do not hold the provider_settings lock for more than necessary
        let provider_settings = {
            debug!("Acquiring a read lock on sequencer_config for `{net}`");
            let providers_config = sequencer_state.sequencer_config.read().await;
            debug!("Acquired a read lock on sequencer_config for `{net}`");
            let providers_config = &providers_config.providers;

            let Some(provider_settings) = providers_config.get(net).cloned() else {
                warn!(
                        "Network `{net}` is not configured in sequencer; skipping it during second round consensus"
                    );
                debug!("About to release a read lock on sequencer_config for `{net}` [continue 1]");
                continue;
            };

            if !provider_settings.is_enabled {
                warn!("Network `{net}` is not enabled; skipping it for second round consensus");
                debug!("About to release a read lock on sequencer_config for `{net}` [continue 2]");
                continue;
            } else {
                info!("Network `{net}` is enabled; initiating second round consensus");
            }
            if provider_settings.contracts.iter().find(|x| x.name == GNOSIS_SAFE_CONTRACT_NAME).is_none() {
                info!("Network `{net}` not configured for second round consensus - skipping");
                continue;
            }
            // TODO: remove when we start using ADFS contracts
            if provider_settings.contracts.iter().find(|x| x.name == ADFS_CONTRACT_NAME).is_none() {
                 info!("Network `{net}` uses legacy contracts; skipping second round consensus");
                 continue;
            }
            debug!("About to release a read lock on sequencer_config for `{net}` [default]");
            provider_settings
        };

        // Those are all the updates produced by the blocksense system. We clone here, because
        // each supported network can be configured to have a subset of the feeds and below we
        // perform this filtering
        let mut updates = updates.clone();

        let feeds_config = sequencer_state.active_feeds.clone();

        let mut feeds_rounds = HashMap::new();

        let serialized_updates = match get_serialized_updates_for_network(
            net,
            provider,
            &mut updates,
            &provider_settings,
            feeds_config,
            &mut feeds_rounds,
        )
        .await
        {
            Ok(res) => {
                debug!("Got serialized updates for network {net}");
                res
            }
            Err(e) => {
                warn!("Could not get serialized updates for network {net} due to: {e}");
                continue;
            }
        };

        if updates.updates.is_empty() {
            debug!("No aggregated batch update for network {net}");
            continue;
        }

        let serialized_updates_hex = hex::encode(&serialized_updates);

        let (contract_address, safe_address, nonce, chain_id, tx_hash, safe_transaction) = {
            let provider = provider.lock().await;

            let contract_address = provider
                .get_contract_address(HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME)
                .unwrap_or(Address::default());
            let safe_address = provider
                .get_contract_address(GNOSIS_SAFE_CONTRACT_NAME)
                .unwrap_or(Address::default());
            let contract = SafeMultisig::new(safe_address, &provider.provider);

            let nonce = match contract.nonce().call().await {
                Ok(n) => n,
                Err(e) => {
                    error!("Failed to get the nonce of gnosis safe contract at address {safe_address} in network {net}: {e}!");
                    return;
                }
            };

            info!(
                "Got block height {block_height} and serialized updates = {serialized_updates_hex}",
            );

            let calldata = Bytes::from(serialized_updates);

            let safe_transaction = create_safe_tx(contract_address, calldata, nonce._0);

            let chain_id = match provider.provider.get_chain_id().await {
                Ok(c) => c,
                Err(e) => {
                    error!("Failed to get chain_id in network {net}: {e}!");
                    return;
                }
            };

            let tx_hash = generate_transaction_hash(
                safe_address,
                U256::from(chain_id),
                safe_transaction.clone(),
            );

            (
                contract_address,
                safe_address,
                nonce,
                chain_id,
                tx_hash,
                safe_transaction,
            )
        };

        let updates_to_kafka = ConsensusSecondRoundBatch {
            sequencer_id,
            block_height,
            contract_address: contract_address.encode_hex(),
            safe_address: safe_address.encode_hex(),
            nonce: nonce._0.to_string(),
            chain_id: chain_id.to_string(),
            tx_hash: tx_hash.to_string(),
            network: net.to_string(),
            calldata: serialized_updates_hex,
            updates: updates.updates,
            feeds_rounds,
        };

        let serialized_updates = match serde_json::to_string(&updates_to_kafka) {
            Ok(res) => res,
            Err(e) => {
                error!("Failed to serialize data for second round conseneus trigger! {e}");
                continue;
            }
        };

        debug!("About to send feed values to kafka; network={net}");
        match kafka_endpoint
            .send(
                FutureRecord::<(), _>::to("aggregation_consensus").payload(&serialized_updates),
                Timeout::After(Duration::from_secs(3 * 60)),
            )
            .await
        {
            Ok(res) => {
                debug!(
                    "Successfully sent batch of aggregated feed values to kafka endpoint: {res:?}; network={net}"
                );
                let mut batches_awaiting_consensus =
                    sequencer_state.batches_awaiting_consensus.write().await;
                batches_awaiting_consensus
                    .insert_new_in_process_batch(&updates_to_kafka, safe_transaction);
            }
            Err(e) => {
                error!("Failed to send batch of aggregated feed values for network: {net}, block height: {block_height} to kafka endpoint! {e:?}")
            }
        }
    }
}
