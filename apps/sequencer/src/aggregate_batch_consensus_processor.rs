use actix_web::web::Data;
use alloy::hex::ToHexExt;
use alloy::providers::Provider;
use blocksense_config::BlockConfig;
use blocksense_feed_registry::{registry::SlotTimeTracker, types::Repeatability};
use blocksense_gnosis_safe::data_types::ReporterResponse;
use blocksense_gnosis_safe::utils::{signature_to_bytes, SignatureWithAddress};
use blocksense_utils::time::current_unix_time;
use tokio::sync::mpsc::UnboundedReceiver;
use tracing::{debug, error, info, warn};

use crate::providers::eth_send_utils::{
    decrement_feeds_round_indexes, get_tx_retry_params, increment_feeds_round_indexes,
};
use crate::providers::provider::{parse_eth_address, GNOSIS_SAFE_CONTRACT_NAME};
use crate::sequencer_state::SequencerState;
use alloy_primitives::{Address, Bytes};
use blocksense_gnosis_safe::utils::SafeMultisig;
use futures_util::stream::{FuturesUnordered, StreamExt};
use std::{io::Error, time::Duration};

use alloy_primitives::Uint;
use std::str::FromStr;

pub async fn aggregation_batch_consensus_loop(
    sequencer_state: Data<SequencerState>,
    block_config: BlockConfig,
    mut aggregate_batch_sig_recv: UnboundedReceiver<(ReporterResponse, SignatureWithAddress)>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("aggregation_batch_consensus_loop")
        .spawn_local(async move {
            let block_height_tracker = SlotTimeTracker::new(
                "aggregation_batch_consensus_loop".to_string(),
                Duration::from_millis(block_config.block_generation_period),
                block_config.genesis_block_timestamp_ms.unwrap_or_else(current_unix_time),
            );

            let timeout_period_blocks = block_config.aggregation_consensus_discard_period_blocks;

            let mut collected_futures = FuturesUnordered::new();

            loop {
                let sequencer_state = sequencer_state.clone();

                tokio::select! {
                    // The first future is a timer that ticks according to the block generation period.
                    _ = block_height_tracker.await_end_of_current_slot(&Repeatability::Periodic) => {

                        debug!("processing aggregation_batch_consensus_loop");

                        let latest_block_height = block_height_tracker.get_last_slot();

                        let mut batches_awaiting_consensus =
                            sequencer_state.batches_awaiting_consensus.write().await;
                        let timed_out_batches = batches_awaiting_consensus
                            .clear_batches_older_than(latest_block_height as u64, timeout_period_blocks);

                        for (net, t) in timed_out_batches {
                            let providers = sequencer_state.providers.read().await;
                            let mut provider = providers.get(net.as_str()).unwrap().lock().await;
                            let ids_vec: Vec<_> = t.updated_feeds_ids.iter().copied().collect();
                            warn!("Tiemed out batch {t:?} while collectiong reporters' signatures for net {net}. Decreasing the round counters for feed_ids: {ids_vec:?}");
                            decrement_feeds_round_indexes(&ids_vec, net.as_str(), &mut provider).await
                        }

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

                                    let mut transaction_retries_count = 0;
                                    let ids_vec: Vec<_> = quorum.updated_feeds_ids.iter().copied().collect();

                                    let block_height = signed_aggregate.block_height;
                                    let net = &signed_aggregate.network;
                                    let providers = sequencer_state_clone.providers.read().await;

                                    let providers_config_guard = sequencer_state.sequencer_config.read().await;
                                    let providers_config = &providers_config_guard.providers;

                                    let mut provider = providers.get(net).unwrap().lock().await;
                                    let signer = &provider.signer;

                                    let transaction_retries_count_limit = provider.transaction_retries_count_limit as u64;
                                    let transaction_retry_timeout_secs = provider.transaction_retry_timeout_secs as u64;
                                    let retry_fee_increment_fraction = provider.retry_fee_increment_fraction;

                                    let safe_address = provider.get_contract_address(GNOSIS_SAFE_CONTRACT_NAME).unwrap_or(Address::default());
                                    let contract = SafeMultisig::new(safe_address, &provider.provider);

                                    let latest_safe_nonce = match contract.nonce().call().await {
                                        Ok(n) => n,
                                        Err(e) => {
                                            decrement_feeds_round_indexes(&ids_vec, net, &mut provider).await;
                                            provider.dec_num_tx_in_progress();
                                            eyre::bail!("Failed to get the nonce of gnosis safe contract at address {safe_address} in network {net}: {e}! Blocksense block height: {block_height}");
                                        }
                                    };

                                    let safe_tx = quorum.safe_tx;

                                    if latest_safe_nonce._0 != safe_tx.nonce {
                                        decrement_feeds_round_indexes(&ids_vec, net, &mut provider).await;
                                        provider.dec_num_tx_in_progress();
                                        eyre::bail!("Nonce in safe contract {} not as expected {}! Skipping transaction. Blocksense block height: {block_height}", latest_safe_nonce._0, safe_tx.nonce);
                                    }

                                    info!("About to post tx {safe_tx:?} for network {net}, Blocksense block height: {block_height}");

                                    let receipt = loop {
                                        let tx_to_send = contract.execTransaction(
                                            safe_tx.to,
                                            safe_tx.value,
                                            safe_tx.data.clone(),
                                            safe_tx.operation,
                                            safe_tx.safeTxGas,
                                            safe_tx.baseGas,
                                            safe_tx.gasPrice,
                                            safe_tx.gasToken,
                                            safe_tx.refundReceiver,
                                            Bytes::copy_from_slice(&signature_bytes),
                                        );

                                        let receipt_result = if transaction_retries_count == 0 {
                                            tx_to_send
                                        } else {

                                            let provider_settings = if let Some(provider_settings) = providers_config.get(net) {
                                                provider_settings
                                            } else {
                                                decrement_feeds_round_indexes(&ids_vec, net, &mut provider).await;
                                                provider.dec_num_tx_in_progress();
                                                eyre::bail!(
                                                    "Logical error! Network `{net}` is not configured in sequencer; skipping it during reporting"
                                                );
                                            };

                                            let provider_metrics = provider.provider_metrics.clone();

                                            let (sender_address, is_impersonated) = match &provider_settings.impersonated_anvil_account {
                                                Some(impersonated_anvil_account) => {
                                                    debug!(
                                                        "Using impersonated anvil account with address: {}",
                                                        impersonated_anvil_account
                                                    );
                                                    (parse_eth_address(impersonated_anvil_account).unwrap(), true)
                                                }
                                                None => {
                                                    debug!("Using signer address: {}", signer.address());
                                                    (signer.address(), false)
                                                }
                                            };

                                            let (nonce, max_fee_per_gas, priority_fee) = match get_tx_retry_params(
                                                net.as_str(),
                                                &provider.provider,
                                                &sender_address,
                                                transaction_retry_timeout_secs,
                                                transaction_retries_count,
                                                retry_fee_increment_fraction
                                            ).await {
                                                Ok(res) => res,
                                                Err(e) => {
                                                    transaction_retries_count += 1;
                                                    continue;
                                                },
                                            };

                                            tx_to_send
                                                .max_priority_fee_per_gas(priority_fee)
                                                .max_fee_per_gas(max_fee_per_gas)
                                                .nonce(nonce)

                                        };

                                        let receipt = match receipt_result.send().await {
                                            Ok(v) => {
                                                info!("Posted tx for network {net}, Blocksense block height: {block_height}! Waiting for receipt ...");
                                                let receipt = v.get_receipt().await;
                                                info!("Got receipt for network {net}, Blocksense block height: {block_height}! {:?}", receipt);
                                                receipt
                                            }
                                            Err(e) => {
                                                decrement_feeds_round_indexes(&ids_vec, net, &mut provider).await;
                                                provider.dec_num_tx_in_progress();
                                                eyre::bail!("Failed to post tx for network {net}: {e}! Blocksense block height: {block_height}");
                                            }
                                        };
                                        break receipt;
                                    };
                                    provider.dec_num_tx_in_progress();
                                    Ok(receipt)
                                }).expect("Failed to spawn tx sender for network {net} Blocksense block height: {block_height}!")
                        );
                    }
                }
            }
        })
        .expect("Failed to spawn aggregation_batch_consensus_loop!")
}
