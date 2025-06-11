use actix_web::web::Data;
use alloy::hex::ToHexExt;
use blocksense_config::BlockConfig;
use blocksense_feed_registry::{registry::SlotTimeTracker, types::Repeatability};
use blocksense_gnosis_safe::data_types::ReporterResponse;
use blocksense_gnosis_safe::utils::{signature_to_bytes, SignatureWithAddress};
use blocksense_metrics::{inc_metric, process_provider_getter};
use blocksense_utils::time::current_unix_time;
use paste::paste;
use tokio::sync::mpsc::UnboundedReceiver;
use tracing::{debug, error, info, warn};

use crate::providers::eth_send_utils::{
    decrement_feeds_round_indexes, get_nonce, get_tx_retry_params, inc_retries_with_backoff,
    log_gas_used,
};
use crate::providers::provider::{parse_eth_address, RpcProvider, GNOSIS_SAFE_CONTRACT_NAME};
use crate::sequencer_state::SequencerState;
use alloy_primitives::{Address, Bytes};
use blocksense_gnosis_safe::utils::SafeMultisig;
use futures_util::stream::{FuturesUnordered, StreamExt};
use std::time::Instant;
use std::{io::Error, time::Duration};

pub async fn aggregation_batch_consensus_loop(
    sequencer_state: Data<SequencerState>,
    block_config: BlockConfig,
    mut aggregate_batch_sig_recv: UnboundedReceiver<(ReporterResponse, SignatureWithAddress)>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("aggregation_batch_consensus_loop")
        .spawn(async move {
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
                        info!("Generated aggregated signature: {} for network: {} Blocksense block height: {}", signature_bytes.encode_hex(), net, block_height);

                        let sequencer_state_clone = sequencer_state.clone();
                        collected_futures.push(
                            tokio::task::Builder::new()
                                .name(format!("safe_tx_sender network={net} block={block_height}").as_str())
                                .spawn(async move {

                                    let mut transaction_retries_count = 0;
                                    let mut nonce_get_retries_count = 0;
                                    let ids_vec: Vec<_> = quorum.updated_feeds_ids.iter().copied().collect();
                                    let backoff_secs = 1;

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

                                    let safe_tx = quorum.safe_tx;

                                    info!("About to post tx {safe_tx:?} for network {net}, Blocksense block height: {block_height}");

                                    let tx_time = Instant::now();

                                    let provider_metrics = provider.provider_metrics.clone();

                                    // First get the correct nonce
                                    let nonce = loop {

                                        if nonce_get_retries_count > transaction_retries_count_limit {
                                            failed_tx(net, &ids_vec, &mut provider).await;
                                            eyre::bail!("Failed get the nonce for network {net}! Blocksense block height: {block_height}");
                                        }

                                        let nonce = match get_nonce(
                                            net,
                                            &provider.provider,
                                            &signer.address(),
                                            block_height,
                                            transaction_retry_timeout_secs,
                                            true,
                                        ).await {
                                            Ok(n) => n,
                                            Err(e) => {
                                                warn!("{e}");
                                                inc_retries_with_backoff(net.as_str(), &mut nonce_get_retries_count, &provider_metrics, backoff_secs).await;
                                                continue;
                                            },
                                        };
                                        break nonce;
                                    };

                                    let contract = SafeMultisig::new(safe_address, &provider.provider);

                                    let receipt = loop {

                                        if transaction_retries_count > transaction_retries_count_limit {
                                            failed_tx(net, &ids_vec, &mut provider).await;
                                            inc_metric!(provider_metrics, net, total_timed_out_tx);
                                            eyre::bail!("Failed to post tx after {transaction_retries_count} retries for network {net}: (timed out)! Blocksense block height: {block_height}");
                                        }

                                        let latest_safe_nonce_result = match actix_web::rt::time::timeout(
                                            Duration::from_secs(transaction_retry_timeout_secs),
                                            contract.nonce().call(),
                                        ).await {
                                            Ok(v) => v,
                                            Err(err) => {
                                                warn!("Timed out while trying to get safe nonce for network {net} and address {safe_address} due to {err}");
                                                inc_retries_with_backoff(net.as_str(), &mut transaction_retries_count, &provider_metrics, backoff_secs).await;
                                                continue;
                                            },
                                        };

                                        let latest_safe_nonce = match latest_safe_nonce_result {
                                            Ok(n) => n,
                                            Err(e) => {
                                                warn!("Failed to get the nonce of gnosis safe contract at address {safe_address} in network {net}: {e}! Blocksense block height: {block_height}");
                                                inc_retries_with_backoff(net.as_str(), &mut transaction_retries_count, &provider_metrics, backoff_secs).await;
                                                continue;
                                            }
                                        };

                                        if latest_safe_nonce != safe_tx.nonce {
                                            warn!("Nonce in safe contract {} not as expected {}! Blocksense block height: {block_height}", latest_safe_nonce, safe_tx.nonce);
                                            inc_metric!(provider_metrics, net, total_mismatched_gnosis_safe_nonce);
                                            inc_retries_with_backoff(net.as_str(), &mut transaction_retries_count, &provider_metrics, backoff_secs).await;
                                            continue;
                                        }

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

                                        let safe_tx = if transaction_retries_count == 0 {
                                            tx_to_send
                                        } else {

                                            let provider_settings = if let Some(provider_settings) = providers_config.get(net) {
                                                provider_settings
                                            } else {
                                                failed_tx(net, &ids_vec, &mut provider).await;
                                                eyre::bail!(
                                                    "Logical error! Network `{net}` is not configured in sequencer; skipping it during reporting"
                                                );
                                            };

                                            let (sender_address, _is_impersonated) = match &provider_settings.impersonated_anvil_account {
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

                                            let (max_fee_per_gas, priority_fee) = match get_tx_retry_params(
                                                net.as_str(),
                                                &provider.provider,
                                                &provider.provider_metrics,
                                                &sender_address,
                                                transaction_retry_timeout_secs,
                                                transaction_retries_count,
                                                retry_fee_increment_fraction
                                            ).await {
                                                Ok(res) => res,
                                                Err(e) => {
                                                    warn!("Timed out on get_tx_retry_params for {transaction_retries_count}-th time for network {net}, Blocksense block height: {block_height}: {e}!");
                                                    inc_retries_with_backoff(net.as_str(), &mut transaction_retries_count, &provider_metrics, backoff_secs).await;
                                                    continue;
                                                },
                                            };

                                            tx_to_send
                                                .max_priority_fee_per_gas(priority_fee)
                                                .max_fee_per_gas(max_fee_per_gas)
                                                .nonce(nonce)

                                        };

                                        debug!("Sending price feed update transaction to network `{net}`...");
                                        let result = match actix_web::rt::time::timeout(
                                            Duration::from_secs(transaction_retry_timeout_secs),
                                            safe_tx.send(),
                                        )
                                        .await
                                        {
                                            Ok(post_tx_res) => post_tx_res,
                                            Err(err) => {
                                                warn!("Timed out while trying to post tx to RPC for network {net} and address {safe_address} due to {err}");
                                                inc_retries_with_backoff(net.as_str(), &mut transaction_retries_count, &provider_metrics, backoff_secs).await;
                                                continue;
                                            }
                                        };
                                        debug!("Sent price feed update transaction to network `{net}`");

                                        inc_metric!(provider_metrics, net, total_tx_sent);

                                        let receipt = match process_provider_getter!(result, net, provider_metrics, send_tx) {
                                            Ok(v) => {
                                                info!("Posted tx for network {net}, Blocksense block height: {block_height}! Waiting for receipt ...");
                                                let receipt = match actix_web::rt::time::timeout(
                                                    Duration::from_secs(transaction_retry_timeout_secs),
                                                    v.get_receipt(),
                                                ).await {
                                                    Ok(r) => r,
                                                    Err(err) => {
                                                        warn!("Timed out while trying to post tx to RPC for network {net} and address {safe_address} due to {err}");
                                                        inc_retries_with_backoff(net.as_str(), &mut transaction_retries_count, &provider_metrics, backoff_secs).await;
                                                        continue;
                                                    }
                                                };

                                                let transaction_time = tx_time.elapsed().as_millis();
                                                info!("Got receipt from network {net} that took {transaction_time}ms for {transaction_retries_count} retries, Blocksense block height: {block_height}! {receipt:?}");

                                                match &receipt {
                                                    Ok(receipt) => {
                                                        inc_metric!(provider_metrics, net, success_get_receipt);
                                                        log_gas_used(net, receipt, transaction_time, &provider.provider_metrics).await;
                                                    }
                                                    Err(e) => {
                                                        inc_metric!(provider_metrics, net, failed_get_receipt);
                                                        warn!("Error in getting receipt from network {net} that took {transaction_time}ms for {transaction_retries_count} retries, Blocksense block height: {block_height}! {receipt:?}: {e}");
                                                    }
                                                }

                                                receipt
                                            }
                                            Err(e) => {
                                                failed_tx(net, &ids_vec, &mut provider).await;
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

async fn failed_tx(net: &str, ids_vec: &Vec<u32>, provider: &mut RpcProvider) {
    decrement_feeds_round_indexes(ids_vec, net, provider).await;
    provider.dec_num_tx_in_progress();
}
