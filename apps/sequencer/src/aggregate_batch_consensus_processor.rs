use actix_web::web::Data;
use alloy::hex::ToHexExt;
use config::BlockConfig;
use feed_registry::{registry::SlotTimeTracker, types::Repeatability};
use gnosis_safe::data_types::ReporterResponse;
use gnosis_safe::utils::{signature_to_bytes, SignatureWithAddress};
use tokio::sync::mpsc::UnboundedReceiver;
use tracing::{debug, error, info};
use utils::time::{current_unix_time, system_time_to_millis};

use crate::providers::provider::GNOSIS_SAFE_CONTRACT_NAME;
use crate::sequencer_state::SequencerState;
use alloy_primitives::{Address, Bytes};
use futures_util::stream::{FuturesUnordered, StreamExt};
use gnosis_safe::utils::SafeMultisig;
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

                                    let mut timed_out_count = 0;
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

/*
safe_transaction = SafeTx {
    to: 0xe7f1725e7734ce288f8367e1bb143e90bb3f0512,
    value: 0,
    data: 0x1a2d80ac0000000048656c6c6f2c20576f726c642120300000000000000000000000000000000000,
    operation: 0,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: 0x0000000000000000000000000000000000000000,
    refundReceiver: 0x0000000000000000000000000000000000000000,
    nonce: 20
}
signature_bytes = 5a0be0c32303d979ababf01f26d204ae2056daf2c04f682dd64f943fbd1e29d935af90f44e0b687a53f7cfe9f861b758c28c84709ba2b97dd811c06ee2e424591c28d83bdae443d0bd366c4c4ca2cd359387acd4f80d881b7d0c583f6b818f2bb86cee958529dc3fdc859d493c7d212fccf5e57544b31b968e3157075440e7e3b01c05c87e677e8374dcfb0fcc998afb1b5c4d626f25fde5f2f1349f0a33859a054160532b036c4699179fe8955631230c3c04dbed59fd409ae3e869d34fd76ab9ab1b24f802f0f34f88c87565ee1096dec4cc07d7d3668fe03a67f787a2ee920b4fae02843c6b56a46d757b9c74fb30512a0fb7a2a335b961191588540ed4f70957401b538eaf55ca6818ba5f39f05e908bd2fae09003910ce3a8cc269f1b12132ad2ca55a1c714e8cc877843fc45364bf0625eca26a5b841d1e27e955f82be9cb419311b1da6ad23b62c43cc6a883f366cf111b91b91d21055ca1744278ba3fdb8baa34d6d1b1114bf7925fc5e155c2efe02696333b1844dba4c0f781527ef5c6a323eb81b57a63e69463ff6fafce616c43e777c0804bc5dc28876d1cc6bac87eb422851ae5a44b4007ce85c6114bf6fb127488ab0ec7d497c66392df34efe48882ef8f6b51c
*/

                                    let num: u32 = 0;
                                    let uint256: Uint<256, 4> = Uint::from(num);

                                    let result = match contract
                                    .execTransaction(
                                        Address::from_str("0xe7f1725e7734ce288f8367e1bb143e90bb3f0512").unwrap(),
                                        uint256,
                                        Bytes::from_str("0x1a2d80ac0000000048656c6c6f2c20576f726c642120300000000000000000000000000000000000").unwrap(),
                                        0,
                                        uint256,
                                        uint256,
                                        uint256,
                                        Address::from_str("0x0000000000000000000000000000000000000000").unwrap(),
                                        Address::from_str("0x0000000000000000000000000000000000000000").unwrap(),
                                        Bytes::from_str("0x361f6a792c335bdb1ee4ac636cc268c1d74a496a57538fd710f312763d842e0937480c351333f8f0e0d853e3458f4a6e347f4e06939f8cd53498d1b85a14cd601b94a85682508ade7e516f10b8c056eabb7c9905afb5458efd66209c277cf7031d61c8175441045d40f399801efb1f6130d1044ba902e835b2fc827789a0a795d61c60544be578f0b212a30bd58daba207aac9a8c488e551a21de2163b9f900df18627ffa14da3fbaf24fa249325bfee8f06a9582ee56a5e303c2bd2a8e84541cfa81ce6574ff4665dff1d78add9a3479bef1777ae36b33123877dd6a37cd983a76fb8125d0ab2ecdd485df27fbb00ada3fb0558c9afd53bc863821b2e4ad3734d58c81ba04cd15a2be00957394eb8eb41abff8f4b29ae8a0835246f99dad692a00031842773461dae071e1a1ebffad297bae1190bd2ede444321f0f7eb780963aaee5bf1c3ce0906e46a6d04580e0eb3061e048f27e56c22f38f84597df91beec3ab5024c69bc6998fd53b357f8387d882709aa191166bdc977c36d4de68f0683e2e309eb1c9b1e0f28ab837974426aa3eca197e9e5ff24b8122d142469cdc4e71054bcd9ea07b0ed825bd286609891494cad80d1ad5d29b8bec0508dcee268403ccb0397c31b").unwrap(),
                                    ).max_fee_per_gas(5)
                                    .max_priority_fee_per_gas(5)
                                    .send()
                                    .await {
                                        Ok(v) => {
                                            info!("Posted tx for network {net}, Blocksense block height: {block_height}! Waiting for receipt ...");
                                            info!("Got receipt for network {net}, Blocksense block height: {block_height}! {:?}", v.get_receipt()
                                            .await)
                                        }
                                        Err(e) => {
                                            eyre::bail!("Failed to post tx for network {net}: {e}! Blocksense block height: {block_height}");
                                        }
                                    };

                                    Ok(result)
                                }).expect("Failed to spawn tx sender for network {net} Blocksense block height: {block_height}!")
                        );
                    }
                }
            }
        })
        .expect("Failed to spawn aggregation_batch_consensus_loop!")
}
