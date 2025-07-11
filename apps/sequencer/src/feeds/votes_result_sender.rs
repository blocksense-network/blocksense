use crate::providers::eth_send_utils::{
    eth_batch_send_to_all_contracts, get_serialized_updates_for_network,
};
use crate::providers::eth_send_utils::{increment_feeds_round_indexes, log_provider_enabled};
use crate::providers::provider::{GNOSIS_SAFE_CONTRACT_NAME, PRICE_FEED_CONTRACT_NAME};
use crate::sequencer_state::SequencerState;
use actix_web::web::Data;
use alloy::hex::{self, ToHexExt};
use alloy::providers::Provider;
use alloy_primitives::map::HashMap;
use alloy_primitives::{Address, Bytes, Uint, U256};
use blocksense_data_feeds::feeds_processing::{
    BatchedAggregatesToSend, EncodedBatchedAggregatesToSend, EncodedVotedFeedUpdate,
};
use blocksense_feed_registry::types::Repeatability::Periodic;
use blocksense_gnosis_safe::data_types::ConsensusSecondRoundBatch;
use blocksense_gnosis_safe::utils::{create_safe_tx, generate_transaction_hash, SafeMultisig};
use eyre::Result;
use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::util::Timeout;
use std::io::Error;
use std::time::Duration;
use tokio::sync::mpsc::UnboundedReceiver;
use tracing::{debug, error, info, warn};

pub async fn votes_result_sender_loop(
    mut batched_votes_recv: UnboundedReceiver<BatchedAggregatesToSend>,
    sequencer_state: Data<SequencerState>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("votes_result_sender")
        .spawn(async move {
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

                        aggregated_updates_to_publishers(&sequencer_state, &updates).await;

                        info!("sending updates to contracts:");
                        let sequencer_state = sequencer_state.clone();
                        let blocksense_block_height = updates.block_height;
                        debug!("Processing eth_batch_send_to_all_contracts{blocksense_block_height}_{batch_count}");
                        match eth_batch_send_to_all_contracts(sequencer_state, updates, Periodic).await {
                            Ok(_) => info!("Sending updates to relayers complete."),
                            Err(err) => error!("ERROR Sending updates to relayers: {err}"),
                        };
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

async fn aggregated_updates_to_publishers(
    sequencer_state: &Data<SequencerState>,
    updates: &BatchedAggregatesToSend,
) {
    let Some(kafka_endpoint) = &sequencer_state.kafka_endpoint else {
        warn!("No Kafka endpoint set to stream aggregated updates to publishers.");
        return;
    };

    let block_height = updates.block_height;

    let encoded_updates = EncodedBatchedAggregatesToSend {
        block_height,
        updates: {
            let mut encoded_voted_feed_updates = Vec::new();
            for v in &updates.updates {
                let feed_id = &v.feed_id;
                debug!("Acquiring a read lock on feeds_config; feed_id={feed_id}");
                let Some(feed_config) = sequencer_state
                    .active_feeds
                    .read()
                    .await
                    .get(feed_id)
                    .cloned()
                else {
                    error!("Acquired and released a read lock on feeds_config; feed_id={feed_id} but feed_id not in registry!");
                    continue;
                };
                debug!("Acquired and released a read lock on feeds_config; feed_id={feed_id}");

                encoded_voted_feed_updates.push(EncodedVotedFeedUpdate {
                    feed_id: *feed_id,
                    value: match v.value.as_bytes(
                        feed_config.additional_feed_info.decimals as usize,
                        v.end_slot_timestamp as u64,
                    ) {
                        Ok(bytes) => bytes,
                        Err(e) => {
                            error!("Could not serialize {v:?}' value to bytes: {e}");
                            continue;
                        }
                    },
                    end_slot_timestamp: v.end_slot_timestamp,
                });
            }
            encoded_voted_feed_updates
        },
    };

    match serde_json::to_string(&encoded_updates) {
        Ok(json) => {
            match send_to_msg_stream(
                kafka_endpoint,
                &json,
                "aggregated_updates",
                3 * 60,
                "blocksense",
                block_height,
            )
            .await
            {
                Ok(_) => {
                    info!(
                        "sent aggregated updates to publishers for block_height: {block_height}."
                    );
                }
                Err(e) => {
                    error!("send_to_msg_stream: {e}");
                }
            }
        }
        Err(e) => {
            error!("Could not serialize updates: {updates:?} due to Error: {e}")
        }
    };
}

async fn try_send_aggregation_consensus_trigger_to_reporters(
    sequencer_state: &Data<SequencerState>,
    updates: &BatchedAggregatesToSend,
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

            if provider_settings.safe_address.is_none() {
                info!("Network `{net}` not configured for second round consensus - skipping");
                continue;
            }

            let is_enabled_value = provider_settings.is_enabled;

            log_provider_enabled(net.as_str(), provider, is_enabled_value).await;

            if !is_enabled_value {
                warn!("Network `{net}` is not enabled; skipping it for second round consensus");
                debug!("About to release a read lock on sequencer_config for `{net}` [continue 2]");
                continue;
            } else {
                info!("Network `{net}` is enabled; initiating second round consensus");
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
        // After filtering for the network, we extract the feed_id-s that need round counter increment
        let updated_feeds_ids = updates.updates.iter().cloned().map(|u| u.feed_id).collect();

        let serialized_updates_hex = hex::encode(&serialized_updates);

        let (contract_address, safe_address, nonce, chain_id, tx_hash, safe_transaction) = {
            let provider = provider.lock().await;

            let contract_address = provider
                .get_contract_address(PRICE_FEED_CONTRACT_NAME)
                .unwrap_or(Address::default());
            let safe_address = provider
                .get_contract_address(GNOSIS_SAFE_CONTRACT_NAME)
                .unwrap_or(Address::default());
            let contract = SafeMultisig::new(safe_address, &provider.provider);

            let mut nonce = match contract.nonce().call().await {
                Ok(n) => n,
                Err(e) => {
                    error!("Failed to get the nonce of gnosis safe contract at address {safe_address} in network {net}: {e}!");
                    return;
                }
            };

            let num_tx_in_progress = provider.get_num_tx_in_progress();

            info!(
                "Got block height {block_height} and serialized updates = {serialized_updates_hex}; num tx-s being processed = {num_tx_in_progress}",
            );

            let calldata = Bytes::from(serialized_updates);

            nonce += Uint::from(num_tx_in_progress);

            let safe_transaction = create_safe_tx(contract_address, calldata, nonce);

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
            nonce: nonce.to_string(),
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
                error!("Failed to serialize data for second round consensus trigger! {e}");
                continue;
            }
        };

        info!("About to send feed values to kafka, serialized_updates={serialized_updates}");
        match send_to_msg_stream(
            kafka_endpoint,
            &serialized_updates,
            "aggregation_consensus",
            3 * 60,
            net,
            block_height,
        )
        .await
        {
            Ok(_) => {
                let mut batches_awaiting_consensus =
                    sequencer_state.batches_awaiting_consensus.write().await;
                batches_awaiting_consensus
                    .insert_new_in_process_batch(&updates_to_kafka, safe_transaction);
            }
            Err(e) => {
                error!("send_to_msg_stream: {e}");
            }
        }

        {
            let mut provider = provider.lock().await;
            increment_feeds_round_indexes(&updated_feeds_ids, net, &mut provider).await;
            provider.inc_num_tx_in_progress();
        }
    }
}

async fn send_to_msg_stream(
    endpoint: &FutureProducer,
    serialized_updates: &String,
    topic: &str,
    timeout_secs: u64,
    net: &str,
    block_height: u64,
) -> eyre::Result<()> {
    match endpoint
        .send(
            FutureRecord::<(), _>::to(topic).payload(serialized_updates),
            Timeout::After(Duration::from_secs(timeout_secs)),
        )
        .await
    {
        Ok(res) => {
            debug!(
                "Successfully sent batch of aggregated feed values to kafka endpoint: {res:?}; network: {net} topic: {topic}"
            );
            Ok(())
        }
        Err(e) => {
            eyre::bail!("Failed to send batch of aggregated feed values for network: {net}, topic: {topic}, block height: {block_height} to kafka endpoint! Error: {e:?}");
        }
    }
}
