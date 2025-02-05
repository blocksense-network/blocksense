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

                        let quorum = match batches_awaiting_consensus.take_reporters_signatures(signed_aggregate.block_height, signed_aggregate.network.clone()){
                            Some(v) => v,
                            None => {
                                error!("Error getting signatures of a full quorum!");
                                continue
                            },
                        };
                        let mut signatures_with_addresses: Vec<&_> = quorum.signatures.values().collect();
                        signatures_with_addresses.sort_by(|a, b| a.signer_address.cmp(&b.signer_address));
                        let signature_bytes: Vec<u8> = signatures_with_addresses
                            .into_iter()
                            .flat_map(|entry| signature_to_bytes(entry.signature))
                            .collect();
                        info!("Generated aggregated signature: {} for network: {} block_height: {}", signature_bytes.encode_hex(), signed_aggregate.network, signed_aggregate.block_height);
                    }
                }
            }
        })
        .expect("Failed to spawn aggregation_batch_consensus_loop!")
}
