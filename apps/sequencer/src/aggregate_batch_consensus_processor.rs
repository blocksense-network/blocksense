use actix_web::web::Data;
use alloy::hex::ToHexExt;
use blocksense_config::BlockConfig;
use blocksense_feed_registry::{registry::SlotTimeTracker, types::Repeatability};
use blocksense_gnosis_safe::data_types::ReporterResponse;
use blocksense_gnosis_safe::utils::{signature_to_bytes, SignatureWithAddress};
use blocksense_utils::time::{current_unix_time, system_time_to_millis};
use tokio::sync::mpsc::UnboundedReceiver;
use tracing::{debug, error, info};

use crate::providers::provider::GNOSIS_SAFE_CONTRACT_NAME;
use crate::sequencer_state::SequencerState;
use alloy_primitives::{Address, Bytes};
use blocksense_gnosis_safe::utils::SafeMultisig;
use futures_util::stream::{FuturesUnordered, StreamExt};
use std::{io::Error, time::Duration};

pub async fn aggregation_batch_consensus_loop(
    sequencer_state: Data<SequencerState>,
    block_config: BlockConfig,
    mut aggregate_batch_sig_recv: UnboundedReceiver<(ReporterResponse, SignatureWithAddress)>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("aggregation_batch_consensus_loop")
        .spawn_local(async move {
            let block_genesis_time = match block_config.genesis_block_timestamp {
                Some(genesis_time) => system_time_to_millis(genesis_time),
                None => current_unix_time(),
            };

            let block_height_tracker = SlotTimeTracker::new(
                "aggregation_batch_consensus_loop".to_string(),
                Duration::from_millis(block_config.block_generation_period),
                block_genesis_time,
            );

            let timeout_period_blocks = block_config.aggregation_consensus_discard_period_blocks;

            let mut collected_futures = FuturesUnordered::new();

            loop {
                tokio::select! {
                    // The first future is a timer that ticks according to the block generation period.
                    _ = block_height_tracker.await_end_of_current_slot(&Repeatability::Periodic) => {

                        debug!("processing aggregation_batch_consensus_loop");

                        let latest_block_height = block_height_tracker.get_last_slot();

                        let mut batches_awaiting_consensus =
                            sequencer_state.batches_awaiting_consensus.write().await;
                        batches_awaiting_consensus
                            .clear_batches_older_than(latest_block_height as u64, timeout_period_blocks);

                        // Loop to process all completed futures for sending TX-s.
                        // Once all available completed futures are processed, control
                        // is returned. collected_futures.next() is an unblocking call
                        loop {
                            futures::select! {
                                future_result = collected_futures.next() => {
                                    match future_result {
                                        Some(res) => {
                                            let result_val = match res {
                                                Ok(v) => v,
                                                Err(e) => {
                                                    // We error here, to support the task returning errors.
                                                    error!("Task terminated with error: {:?}", e);
                                                    continue;
                                                }
                                            };

                                            match result_val {
                                                Ok(v) => {
                                                    info!("tx receipt: {v:?}");
                                                },
                                                Err(e) => {
                                                    error!("Failed to get tx receipt: {e}");
                                                },
                                            };
                                        },
                                        None => {
                                            debug!("aggregation_batch_consensus_loop got none from collected_futures");
                                            break;
                                        },
                                    }
                                },
                                complete => {
                                    debug!("aggregation_batch_consensus_loop collected_futures empty");
                                    break;
                                },
                            }
                        }
                    }
                    // The second future is a signature received from a reporter on the HTTP endpoint post_aggregated_consensus_vote.
                    Some((signed_aggregate, signature_with_address)) = aggregate_batch_sig_recv.recv() => {
                        info!("aggregate_batch_sig_recv.recv()");

                        let block_height = signed_aggregate.block_height;
                        let net = &signed_aggregate.network;

                        // Get quorum size from config before locking batches_awaiting_consensus!
                        let safe_min_quorum = {
                            let sequencer_config = sequencer_state.sequencer_config.read().await;
                            match sequencer_config.providers.get(net) {
                                Some(v) => v.safe_min_quorum,
                                None => {
                                    error!("Trying to get the quorum size of a non existent network!");
                                    continue
                                },
                            }
                        };

                        let mut batches_awaiting_consensus = sequencer_state
                            .batches_awaiting_consensus
                            .write()
                            .await;

                        if (batches_awaiting_consensus.insert_reporter_signature(&signed_aggregate, signature_with_address) as u32) < safe_min_quorum
                        {
                            continue
                        }

                        let Some(quorum) = batches_awaiting_consensus.take_reporters_signatures(block_height, net.clone()) else {
                            error!("Error getting signatures of a full quorum! net {net}, Blocksense block height {block_height}");
                            continue;
                        };

                        drop(batches_awaiting_consensus);

                        let mut signatures_with_addresses: Vec<&_> = quorum.signatures.values().collect();
                        signatures_with_addresses.sort_by(|a, b| a.signer_address.cmp(&b.signer_address));
                        let signature_bytes: Vec<u8> = signatures_with_addresses
                            .into_iter()
                            .flat_map(|entry| signature_to_bytes(entry.signature))
                            .collect();
                        info!("Generated aggregated signature: {} for network: {} Blocksense block_height: {}", signature_bytes.encode_hex(), net, block_height);

                        let sequencer_state_clone = sequencer_state.clone();
                        collected_futures.push(
                            tokio::task::Builder::new()
                                .name(format!("safe_tx_sender network={net} block={block_height}").as_str())
                                .spawn_local(async move {
                                    let block_height = signed_aggregate.block_height;
                                    let net = &signed_aggregate.network;
                                    let providers = sequencer_state_clone.providers.read().await;
                                    let provider = providers.get(net).unwrap().lock().await;
                                    let safe_address = provider.get_contract_address(GNOSIS_SAFE_CONTRACT_NAME).unwrap_or(Address::default());
                                    let contract = SafeMultisig::new(safe_address, &provider.provider);

                                    let latest_nonce = match contract.nonce().call().await {
                                        Ok(n) => n,
                                        Err(e) => {
                                            eyre::bail!("Failed to get the nonce of gnosis safe contract at address {safe_address} in network {net}: {e}! Blocksense block height: {block_height}");
                                        }
                                    };

                                    let safe_tx = quorum.safe_tx;

                                    if latest_nonce._0 != safe_tx.nonce {
                                        eyre::bail!("Nonce in safe contract {} not as expected {}! Skipping transaction. Blocksense block height: {block_height}", latest_nonce._0, safe_tx.nonce);
                                    }

                                    Ok(match contract
                                    .execTransaction(
                                        safe_tx.to,
                                        safe_tx.value,
                                        safe_tx.data,
                                        safe_tx.operation,
                                        safe_tx.safeTxGas,
                                        safe_tx.baseGas,
                                        safe_tx.gasPrice,
                                        safe_tx.gasToken,
                                        safe_tx.refundReceiver,
                                        Bytes::copy_from_slice(&signature_bytes),
                                    )
                                    .send()
                                    .await {
                                        Ok(v) => {
                                            info!("Posted tx for network {net}, Blocksense block height: {block_height}! Waiting for receipt ...");
                                            v.get_receipt()
                                            .await
                                        }
                                        Err(e) => {
                                            eyre::bail!("Failed to post tx for network {net}: {e}! Blocksense block height: {block_height}");
                                        }
                                    })
                                }).expect("Failed to spawn tx sender for network {net} Blocksense block height: {block_height}!")
                        );
                    }
                }
            }
        })
        .expect("Failed to spawn aggregation_batch_consensus_loop!")
}
