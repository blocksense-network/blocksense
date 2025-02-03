use actix_web::web::Data;
use alloy::hex::ToHexExt;
use config::BlockConfig;
use feed_registry::{registry::SlotTimeTracker, types::Repeatability};
use gnosis_safe::data_types::ReporterResponse;
use gnosis_safe::utils::{signature_to_bytes, SignatureWithAddress};
use tokio::select;
use tokio::sync::mpsc::UnboundedReceiver;
use tracing::{error, info, trace};
use utils::time::{current_unix_time, system_time_to_millis};

use crate::sequencer_state::SequencerState;
use alloy_primitives::{Address, Bytes};
use gnosis_safe::utils::SafeMultisig;
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

            loop {
                select! {
                    _ = block_height_tracker.await_end_of_current_slot(&Repeatability::Periodic) => {

                        trace!("processing aggregation_batch_consensus_loop");

                        let latest_block_height = block_height_tracker.get_last_slot();

                        let mut batches_awaiting_consensus =
                            sequencer_state.batches_awaiting_consensus.write().await;
                        batches_awaiting_consensus
                            .clear_batches_older_than(latest_block_height as u64, timeout_period_blocks);
                    }
                    Some((signed_aggregate, signature_with_address)) = aggregate_batch_sig_recv.recv() => {

                        // Get quorum size from config bedore locking batches_awaiting_consensus!
                        let safe_min_quorum = {
                            let sequencer_config = sequencer_state.sequencer_config.read().await;
                            match sequencer_config.providers.get(&signed_aggregate.network) {
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

                        let Some(quorum) = batches_awaiting_consensus.take_reporters_signatures(signed_aggregate.block_height, signed_aggregate.network.clone()) else {
                            error!("Error getting signatures of a full quorum! net {}, Blocksense block height {}", signed_aggregate.network, signed_aggregate.block_height);
                            continue;
                        };

                        drop(batches_awaiting_consensus);

                        let mut signatures_with_addresses: Vec<&_> = quorum.signatures.values().collect();
                        signatures_with_addresses.sort_by(|a, b| a.signer_address.cmp(&b.signer_address));
                        let signature_bytes: Vec<u8> = signatures_with_addresses
                            .into_iter()
                            .flat_map(|entry| signature_to_bytes(entry.signature))
                            .collect();
                        info!("Generated aggregated signature: {} for network: {} block_height: {}", signature_bytes.encode_hex(), signed_aggregate.network, signed_aggregate.block_height);

                        let net = &signed_aggregate.network;
                        let providers = sequencer_state.providers.read().await;
                        let provider = providers.get(net).unwrap().lock().await;

                        let safe_address = provider.safe_address.unwrap_or(Address::default());
                        let contract = SafeMultisig::new(safe_address, &provider.provider);

                        let nonce = match contract.nonce().call().await {
                            Ok(n) => n,
                            Err(e) => {
                                error!("Failed to get the nonce of gnosis safe contract at address {safe_address} in network {net}: {e}!");
                                continue;
                            }
                        };

                        let safe_tx = quorum.safe_tx;

                        if nonce._0 != safe_tx.nonce {
                            error!("Mismatch nonces!");
                        } else {
                            let transaction = contract
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
                            .await.unwrap()
                            .get_receipt()
                            .await.unwrap();

                            info!("Transaction receipt: {:?}", transaction);
                        }

                    }
                }
            }
        })
        .expect("Failed to spawn aggregation_batch_consensus_loop!")
}
