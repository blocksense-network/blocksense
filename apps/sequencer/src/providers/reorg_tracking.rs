use crate::providers::provider::{ProviderType, RpcProvider, SharedRpcProviders};
use actix_web::rt::time::timeout;
use alloy::hex;
use alloy::{eips::BlockNumberOrTag, providers::Provider};
use alloy_primitives::B256;
use blocksense_utils::counter_unbounded_channel::CountedSender;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::Duration;
use tracing::{debug, error, info, trace, warn};

use blocksense_metrics::{inc_metric, inc_vec_metric};
use blocksense_utils::await_time;

// Local helpers from eth_send_utils we need to call
use crate::providers::eth_send_utils::{try_to_sync, BatchOfUpdatesToProcess};

// Helper to handle reorg once already detected. Finds fork point and prints
// discarded observations, mirroring the existing log messages and structure.
#[allow(clippy::too_many_arguments)]
pub(crate) async fn handle_reorg(
    net: &str,
    rpc_handle: &ProviderType,
    provider_mutex: &Arc<Mutex<RpcProvider>>,
    observed_block_hashes: &HashMap<u64, B256>,
    observed_latest_height: u64,
    observer_finalized_height: u64,
    loop_count: u64,
    rpc_timeout: Duration,
    updates_relayer_send_chan: &CountedSender<BatchOfUpdatesToProcess>,
) -> Option<u64> {
    // Build list of observed heights up to observed_latest_height, highest to lowest
    let mut observed_heights: Vec<u64> = observed_block_hashes
        .keys()
        .copied()
        .filter(|h| *h <= observed_latest_height)
        .collect();
    observed_heights.sort_unstable();
    observed_heights.reverse();

    let fmt_hash = |hash: &B256| format!("0x{}", hex::encode(hash.as_slice()));

    let mut diverged_blocks = Vec::new();
    let mut first_common: Option<(u64, B256)> = None;

    for height in observed_heights {
        let stored_hash = match observed_block_hashes.get(&height) {
            Some(hash) => *hash,
            None => continue,
        };
        match timeout(
            rpc_timeout,
            rpc_handle.get_block_by_number(BlockNumberOrTag::Number(height)),
        )
        .await
        {
            Ok(Ok(Some(chain_block))) => {
                let chain_hash = chain_block.header.hash;
                if chain_hash == stored_hash {
                    first_common = Some((height, chain_hash));
                    break;
                } else {
                    diverged_blocks.push((height, chain_hash, stored_hash));
                }
            }
            Ok(Ok(None)) => warn!(
                "Block {height} missing while inspecting reorg in network {net} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})"
            ),
            Ok(Err(e)) => {
                warn!(
                    "Failed to get block {height} in network {net} while inspecting reorg: {e:?} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})"
                )
            }
            Err(_) => {
                warn!(
                    "Timed out getting block {height} in network {net} while inspecting reorg (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})"
                )
            }
        }
    }

    if !diverged_blocks.is_empty() {
        let diverged_description: Vec<String> = diverged_blocks
            .iter()
            .map(|(height, chain_hash, stored_hash)| {
                format!(
                    "height={height}, chain={}, stored={}",
                    fmt_hash(chain_hash),
                    fmt_hash(stored_hash),
                )
            })
            .collect();
        warn!(
            "Diverged blocks observed in network {net}: {} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})",
            diverged_description.join("; ")
        );
    }

    if let Some((common_height, common_hash)) = first_common {
        info!(
            "First common ancestor for reorg in network {net} at height {common_height} with hash {} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})",
            fmt_hash(&common_hash)
        );
        let fork_height = common_height + 1;
        info!("Fork point for reorg in network {net} is at height {fork_height} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})");

        // Print all non-finalized updates at or above the fork height
        {
            let mut provider = provider_mutex.lock().await;
            let mut heights: Vec<u64> = provider
                .inflight
                .non_finalized_updates
                .keys()
                .copied()
                .filter(|h| *h >= fork_height)
                .collect();
            heights.sort_unstable();

            if heights.is_empty() {
                info!(
                    "No non_finalized_updates at or above fork height {fork_height} in network {net} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})"
                );
            } else {
                for h in heights {
                    if let Some(batch) = provider.inflight.non_finalized_updates.remove(&h) {
                        let updates_count = batch.updates.updates.len();
                        info!(
                            "non_finalized_update >= fork: height {h}, batch_block_height {}, updates_count {}, network {} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})",
                            batch.updates.block_height,
                            updates_count,
                            batch.net,
                        );
                        let msgs_in_queue = updates_relayer_send_chan.len();
                        let block_height = batch.updates.block_height;
                        let provider_metrics = &provider.provider_metrics;
                        match updates_relayer_send_chan.send(batch) {
                            Ok(()) => {
                                debug!("Resent updates to relayer for network {net} and block height {block_height}, messages in queue = {msgs_in_queue} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})");
                                inc_metric!(provider_metrics, net, num_transactions_in_queue);
                            }
                            Err(e) => {
                                error!("Error while sending updates to relayer for network {net} and block height {block_height}, messages in queue = {msgs_in_queue}: {e} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})")
                            }
                        };
                    }
                }
            }
        }

        Some(fork_height)
    } else {
        warn!(
            "Failed to find a common ancestor within stored block hashes for reorg in network {net} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})"
        );
        None
    }
}

pub async fn loop_tracking_for_reorg_in_network(
    net: String,
    providers_mutex: SharedRpcProviders,
    reorg_config: blocksense_config::ReorgConfig,
    updates_relayer_send_chan: CountedSender<BatchOfUpdatesToProcess>,
) {
    tracing::info!("Starting tracker for reorgs in network {net} loop...");

    let mut observer_finalized_height = 0;
    let mut observed_latest_height = 0;
    let mut loop_count: u64 = 0;
    let rpc_timeout = Duration::from_secs(reorg_config.rpc_timeout_secs);

    // Loop until block generation time is determined
    let average_block_generation_time: u64 = loop {
        let poll_period = 60 * 1000;
        if let Some(t) = calculate_block_generation_time_in_network(
            net.as_str(),
            &providers_mutex,
            100,
            rpc_timeout,
        )
        .await
        {
            break t;
        } else {
            warn!("Could not determine block generation time for network: {net}. Will retry in {poll_period}ms (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})")
        }
        await_time(poll_period).await;
    };

    loop {
        // Sleep between polls
        await_time(average_block_generation_time).await;

        loop_count += 1;
        debug!("BEGIN loop_tracking_for_reorg_in_network for {net} loop_count: {loop_count}: observer_finalized_height={observer_finalized_height} observed_latest_height={observed_latest_height}!");
        // Scope the lock on providers so we don't hold it across awaits/sleeps
        {
            let providers = providers_mutex.read().await;
            if let Some(provider_mutex) = providers.get(net.as_str()) {
                // Gather data and perform minimal work while holding the provider lock
                let mut need_resync_indices = false;
                {
                    let (rpc_handle, observed_block_hashes, provider_metrics) = {
                        let provider = provider_mutex.lock().await;

                        for (k, v) in provider.inflight.non_finalized_updates.iter() {
                            trace!("We have stored the following observations for network {net} inflight[{k}] = {:?} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})", v.updates);
                        }

                        (
                            provider.provider.clone(),
                            provider.inflight.observed_block_hashes.clone(),
                            provider.provider_metrics.clone(),
                        )
                    };

                    let latest_res = timeout(
                        rpc_timeout,
                        rpc_handle.get_block_by_number(BlockNumberOrTag::Latest),
                    )
                    .await;
                    if let Ok(Ok(Some(b))) = latest_res {
                        let latest_height = b.header.inner.number;
                        if latest_height > observed_latest_height {
                            // Before proceeding, verify whether the block at our observed tip
                            // still matches what we stored. If not, a reorg has occurred.
                            if let Some(stored_hash) =
                                observed_block_hashes.get(&observed_latest_height)
                            {
                                match timeout(
                                    rpc_timeout,
                                    rpc_handle.get_block_by_number(BlockNumberOrTag::Number(
                                        observed_latest_height,
                                    )),
                                )
                                .await
                                {
                                    Ok(Ok(Some(chain_block))) => {
                                        let chain_hash = chain_block.header.hash;
                                        if chain_hash != *stored_hash {
                                            warn!(
                                                "Reorg detected in network {net} at observed tip before processing new blocks (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})"
                                            );
                                            // Increment reorg metric for this network
                                            inc_vec_metric!(provider_metrics, observed_reorgs, net);
                                            let _ = handle_reorg(
                                                net.as_str(),
                                                &rpc_handle,
                                                provider_mutex,
                                                &observed_block_hashes,
                                                observed_latest_height,
                                                observer_finalized_height,
                                                loop_count,
                                                rpc_timeout,
                                                &updates_relayer_send_chan,
                                            )
                                            .await;
                                        }
                                    }
                                    Ok(Ok(None)) => warn!(
                                        "Could not get block {observed_latest_height} in network {net} while pre-checking for reorg (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})"
                                    ),
                                    Ok(Err(e)) => warn!(
                                        "Failed to get block {observed_latest_height} in network {net} while pre-checking for reorg: {e:?} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})"
                                    ),
                                    Err(_) => warn!(
                                        "Timed out getting block {observed_latest_height} in network {net} while pre-checking for reorg (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})"
                                    ),
                                }
                            }
                            info!("Found new blocks in {net} loop_count = {loop_count} latest_height = {latest_height} old value {} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height})", observed_latest_height);

                            // Check for reorg via parent mismatch
                            let first_new_block_height = observed_latest_height + 1;
                            if let Ok(Ok(Some(first_new_block))) = timeout(
                                rpc_timeout,
                                rpc_handle.get_block_by_number(BlockNumberOrTag::Number(
                                    first_new_block_height,
                                )),
                            )
                            .await
                            {
                                if let Some(observed_latest_block_hash) =
                                    observed_block_hashes.get(&observed_latest_height)
                                {
                                    if first_new_block.header.parent_hash
                                        != *observed_latest_block_hash
                                    {
                                        warn!("Reorg detected in network {net} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})");

                                        // Increment reorg metric for this network
                                        inc_vec_metric!(provider_metrics, observed_reorgs, net);
                                        let _ = handle_reorg(
                                            net.as_str(),
                                            &rpc_handle,
                                            provider_mutex,
                                            &observed_block_hashes,
                                            observed_latest_height,
                                            observer_finalized_height,
                                            loop_count,
                                            rpc_timeout,
                                            &updates_relayer_send_chan,
                                        )
                                        .await;
                                    } else {
                                        info!(
                                            "Chain goes on in {net}, loop {loop_count} ... need to add {} new blocks (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height})",
                                            latest_height - observed_latest_height
                                        );
                                        let mut provider = provider_mutex.lock().await;
                                        info!("Adding block with height {first_new_block_height} in network {net} loop_count {loop_count} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height})");
                                        provider.insert_observed_block_hash(
                                            first_new_block_height,
                                            first_new_block.header.hash,
                                        );
                                        for block_height in
                                            first_new_block_height + 1..=latest_height
                                        {
                                            if let Ok(Ok(Some(new_block))) = timeout(
                                                rpc_timeout,
                                                rpc_handle.get_block_by_number(
                                                    BlockNumberOrTag::Number(block_height),
                                                ),
                                            )
                                            .await
                                            {
                                                info!("Further adding block with height {block_height} in network {net} loop_count {loop_count} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height})");
                                                provider.insert_observed_block_hash(
                                                    block_height,
                                                    new_block.header.hash,
                                                );
                                            } else {
                                                warn!("Could not get block {block_height} in network {net} loop_count {loop_count} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height})");
                                            }
                                        }
                                    }
                                } else {
                                    error!("No observed block hash for observed_latest_height = {observed_latest_height} in network {net} loop_count {loop_count}! (observer_finalized_height={observer_finalized_height})");
                                }
                            } else {
                                warn!("Could not get block {first_new_block_height} in network {net} loop_count {loop_count} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height})");
                            }
                            observed_latest_height = latest_height;
                        } else if latest_height < observed_latest_height {
                            info!("Chain went back in network {net} loop_count {loop_count} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height})");
                        } else if latest_height == observed_latest_height {
                            info!(
                                "No new blocks in {net} loop_count {loop_count} latest_height = {latest_height} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height})"
                            );
                            // Even if there are no new blocks, a reorg could have occurred if
                            // the block at our observed_latest_height now has a different hash.
                            if let Some(stored_hash) =
                                observed_block_hashes.get(&observed_latest_height)
                            {
                                let chain_block = &b;
                                let chain_hash = chain_block.header.hash;
                                if chain_hash != *stored_hash {
                                    warn!(
                                                "Reorg detected in network {net} without new tip advancement loop_count {loop_count} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height})"
                                            );
                                    // Increment reorg metric for this network
                                    inc_vec_metric!(provider_metrics, observed_reorgs, net);
                                    let _ = handle_reorg(
                                        net.as_str(),
                                        &rpc_handle,
                                        provider_mutex,
                                        &observed_block_hashes,
                                        observed_latest_height,
                                        observer_finalized_height,
                                        loop_count,
                                        rpc_timeout,
                                        &updates_relayer_send_chan,
                                    )
                                    .await;
                                }
                            }
                        }
                    }

                    // 2) Check the on-chain ADFS root; if it differs from our local view,
                    //    set it so subsequent txs use the correct prev-root and flag resync of indices.
                    {
                        let mut provider = provider_mutex.lock().await;
                        if let Some(contract) = provider.get_latest_contract() {
                            if let Some(contract_address) = contract.address {
                                match timeout(
                                    rpc_timeout,
                                    rpc_handle.get_storage_at(
                                        contract_address,
                                        alloy_primitives::U256::from(0),
                                    ),
                                )
                                .await
                                {
                                    Ok(Ok(chain_root)) => {
                                        let chain_root_h = crate::providers::provider::HashValue(
                                            chain_root.into(),
                                        );
                                        let local_frontier_root =
                                            provider.calldata_merkle_tree_frontier.root();
                                        let tracked_contract_root =
                                            provider.merkle_root_in_contract.clone();

                                        let differs_from_local =
                                            local_frontier_root.0 != chain_root_h.0;

                                        if differs_from_local {
                                            info!(
                                                "Detected state change on-chain for network {net} loop_count {loop_count}. Updating tracked contract root from {:?} / local {:?} to {:?} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height})",
                                                tracked_contract_root, local_frontier_root, chain_root_h
                                            );
                                            provider.merkle_root_in_contract = Some(chain_root_h);
                                            need_resync_indices = true;
                                        }
                                    }
                                    Ok(Err(e)) => warn!(
                                        "Failed to read ADFS root from network `{net}`: {e:?} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})"
                                    ),
                                    Err(_) => {
                                        warn!("Timed out reading ADFS root from network `{net}` (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})")
                                    }
                                }
                            } else {
                                warn!("Could not get contract's address for network: {net} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})");
                            }
                        } else {
                            warn!("No ADFS contract set for network: {net} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})");
                        }
                    }

                    // 1) Observe latest finalized block for logging/visibility
                    match timeout(
                        rpc_timeout,
                        rpc_handle.get_block_by_number(BlockNumberOrTag::Finalized),
                    )
                    .await
                    {
                        Ok(Ok(res)) => match res {
                            Some(eth_finalized_block) => {
                                let mut provider = provider_mutex.lock().await;

                                // Prune non-finalized updates up to finalized height
                                if observer_finalized_height < eth_finalized_block.header.inner.number {
                                    info!("Last finalized block in network {net} = {eth_finalized_block:?} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})");

                                    observer_finalized_height = eth_finalized_block.header.inner.number;
                                    let removed = provider.prune_observed_up_to(observer_finalized_height);
                                    if removed > 0 {
                                        info!("Pruned {removed} non-finalized updates up to finalized height {observer_finalized_height} in `{net}` (observed_latest_height={observed_latest_height}, loop_count={loop_count})");
                                    }
                                }
                                if observed_latest_height < observer_finalized_height {
                                    warn!("Lost track of chain in network {net} beyond a finalized checkpoint: {observer_finalized_height}, last observed block at height: {observed_latest_height} (loop_count={loop_count})");

                                    observed_latest_height = observer_finalized_height;
                                    // Insert current hash into provider cache
                                    provider.insert_observed_block_hash(
                                        observed_latest_height,
                                        eth_finalized_block.header.hash,
                                    );
                                    continue;
                                }
                            }
                            None => {
                                warn!("Could not get finalized block in network {net}, got None! (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})")
                            }
                        },
                        Ok(Err(e)) => {
                            warn!("Could not get finalized block in network {net}: {e:?}! (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})")
                        }
                        Err(_) => warn!("Timed out getting finalized block in network {net} (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})"),
                    };
                };

                // 3) If we detected divergence, resync round-buffer indices from chain
                if need_resync_indices {
                    let mut provider = provider_mutex.lock().await;
                    if let Some(contract) = provider.get_latest_contract() {
                        if let Some(contract_address) = contract.address {
                            try_to_sync(net.as_str(), &mut provider, &contract_address, None).await;
                        }
                    }
                }
            } else {
                info!("Terminating reorg tracker for network {net} since it no longer has an active provider! (observer_finalized_height={observer_finalized_height}, observed_latest_height={observed_latest_height}, loop_count={loop_count})");
                break;
            }
            debug!("END loop_tracking_for_reorg_in_network for {net} loop_count: {loop_count}: observer_finalized_height={observer_finalized_height} observed_latest_height={observed_latest_height}!");
        }
    }
}

/// Calculates the average block generation time over the last `num_blocks`
/// as `(ts_latest - ts_{latest - num_blocks}) / num_blocks` (in milliseconds).
/// Returns `None` if the calculation cannot be performed.
pub async fn calculate_block_generation_time_in_network(
    net: &str,
    providers_mutex: &SharedRpcProviders,
    num_blocks: u64,
    rpc_timeout: Duration,
) -> Option<u64> {
    if num_blocks == 0 {
        warn!("num_blocks must be >= 1 for average block time in network {net}");
        return None;
    }
    let providers = providers_mutex.read().await;
    let Some(provider_mutex) = providers.get(net) else {
        warn!("No active provider found for network {net}");
        return None;
    };
    // Clone the RPC handle and read configured timeout without holding the lock across awaits
    let rpc_handle = {
        let provider = provider_mutex.lock().await;
        provider.provider.clone()
    };

    let latest_block = match timeout(
        rpc_timeout,
        rpc_handle.get_block_by_number(BlockNumberOrTag::Latest),
    )
    .await
    {
        Ok(Ok(Some(b))) => b,
        Ok(Ok(None)) => {
            warn!("Could not get latest block in network {net} (None)");
            return None;
        }
        Ok(Err(e)) => {
            warn!("Error getting latest block in network {net}: {e:?}");
            return None;
        }
        Err(_) => {
            warn!("Timed out getting latest block in network {net}");
            return None;
        }
    };

    let latest_height = latest_block.header.inner.number;
    if latest_height < num_blocks {
        warn!(
            "Latest block height {latest_height} < requested lookback {num_blocks} in network {net}"
        );
        return None;
    }

    let lookback_height = latest_height - num_blocks;
    let prev_block = match timeout(
        rpc_timeout,
        rpc_handle.get_block_by_number(BlockNumberOrTag::Number(lookback_height)),
    )
    .await
    {
        Ok(Ok(Some(b))) => b,
        Ok(Ok(None)) => {
            warn!("Could not get lookback block {lookback_height} in network {net} (None)");
            return None;
        }
        Ok(Err(e)) => {
            warn!("Error getting lookback block {lookback_height} in network {net}: {e:?}");
            return None;
        }
        Err(_) => {
            warn!("Timed out getting lookback block {lookback_height} in network {net}");
            return None;
        }
    };

    let latest_ts = latest_block.header.inner.timestamp;
    let prev_ts = prev_block.header.inner.timestamp;
    if latest_ts < prev_ts {
        warn!(
            "Latest block timestamp < lookback block timestamp in {net}: {} < {}",
            latest_ts, prev_ts
        );
        return None;
    }
    let total_span = latest_ts.saturating_sub(prev_ts);
    // Convert to milliseconds before averaging to preserve precision.
    let total_span_ms = total_span.saturating_mul(1000);
    Some(total_span_ms / num_blocks)
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy::hex::ToHexExt;
    use alloy::node_bindings::Anvil;
    use alloy::primitives::Address;
    use blocksense_config::AllFeedsConfig;
    use blocksense_config::{get_test_config_with_single_provider, test_feed_config};
    use blocksense_data_feeds::feeds_processing::BatchedAggregatesToSend;
    use blocksense_registry::config::FeedConfig;
    use blocksense_utils::counter_unbounded_channel::counted_unbounded_channel;
    use blocksense_utils::EncodedFeedId;
    use std::str::FromStr;
    use tokio::sync::RwLock;

    use crate::providers::eth_send_utils::BatchOfUpdatesToProcess;
    use crate::providers::provider::init_shared_rpc_providers;

    async fn mine_self_txs(
        rpc: &ProviderType,
        signer: &alloy::signers::local::PrivateKeySigner,
        count: u64,
    ) -> eyre::Result<()> {
        use alloy::network::TransactionBuilder;
        use alloy::primitives::U256 as U;
        use alloy::rpc::types::TransactionRequest;

        // Fetch chain id and starting nonce
        let chain_id = rpc.get_chain_id().await?;
        let mut nonce = rpc
            .get_transaction_count(signer.address())
            .pending()
            .await?;

        for _ in 0..count {
            let mut tx = TransactionRequest::default()
                .to(signer.address())
                .from(signer.address())
                .with_chain_id(chain_id)
                .with_nonce(nonce)
                .value(U::from(0u8));
            // Provide minimal gas params since recommended fillers are disabled on the provider
            tx = tx.with_gas_limit(21_000);
            // Use legacy gas pricing for simplicity
            tx = tx.with_gas_price(1_000_000_000u128);

            let pending = rpc.send_transaction(tx).await?;
            let _ = pending.get_receipt().await?;
            nonce += 1;
        }
        Ok(())
    }

    async fn mine_varied_txs(
        rpc: &ProviderType,
        signer: &alloy::signers::local::PrivateKeySigner,
        count: u64,
        gas_price: u128,
    ) -> eyre::Result<()> {
        use alloy::network::TransactionBuilder;
        use alloy::primitives::{Address as Addr, U256 as U};
        use alloy::rpc::types::TransactionRequest;

        let chain_id = rpc.get_chain_id().await?;
        let mut nonce = rpc
            .get_transaction_count(signer.address())
            .pending()
            .await?;

        for i in 0..count {
            // Send to a pseudo-random address derived from i to ensure different block content
            let mut bytes = [0u8; 20];
            bytes[0] = (i & 0xff) as u8;
            bytes[1] = ((i >> 8) & 0xff) as u8;
            let to_addr = Addr::from_slice(&bytes);

            let mut tx = TransactionRequest::default()
                .to(to_addr)
                .from(signer.address())
                .with_chain_id(chain_id)
                .with_nonce(nonce)
                .value(U::from(1u8));
            tx = tx.with_gas_limit(50_000);
            tx = tx.with_gas_price(gas_price);

            let pending = rpc.send_transaction(tx).await?;
            let _ = pending.get_receipt().await?;
            nonce += 1;
        }
        Ok(())
    }

    async fn rpc_call(
        url: &str,
        method: &str,
        params: serde_json::Value,
    ) -> eyre::Result<serde_json::Value> {
        let client = reqwest::Client::new();
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        });
        let resp = client.post(url).json(&body).send().await?;
        let v: serde_json::Value = resp.json().await?;
        if let Some(err) = v.get("error") {
            eyre::bail!(format!("rpc error on {method}: {err}"));
        }
        Ok(v["result"].clone())
    }

    async fn anvil_snapshot(url: &str) -> eyre::Result<String> {
        let res = match rpc_call(url, "anvil_snapshot", serde_json::json!([])).await {
            Ok(v) => v,
            Err(_) => rpc_call(url, "evm_snapshot", serde_json::json!([])).await?,
        };
        let snap_id = if let Some(s) = res.as_str() {
            s.to_string()
        } else if let Some(n) = res.as_u64() {
            format!("0x{:x}", n)
        } else {
            eyre::bail!(format!("Unexpected snapshot id result: {res}"));
        };
        Ok(snap_id)
    }

    async fn anvil_revert(url: &str, snap: &str) -> eyre::Result<()> {
        let params = serde_json::json!([snap]);
        let res = match rpc_call(url, "anvil_revert", params.clone()).await {
            Ok(v) => v,
            Err(_) => rpc_call(url, "evm_revert", params).await?,
        };
        let ok = res.as_bool().unwrap_or(false);
        if !ok {
            eyre::bail!(format!("Snapshot revert failed for id {snap}: {res}"));
        }
        Ok(())
    }

    // End-to-end style test that reproduces a fork and exercises the reorg tracker loop.
    // It also verifies that a resync of indices is initiated when the on-chain root differs
    // from the local calldata-merkle frontier (without deploying contracts).
    #[tokio::test]
    async fn test_loop_tracking_reorg_detect_and_resync_indices() {
        let _ = tracing_subscriber::fmt().with_test_writer().try_init();

        // 1) Spin up anvil and build a provider bound to its first funded key
        let anvil = Anvil::new().try_spawn().unwrap();
        let net = "ETH1";

        // Write the anvil key to a temp file that SequencerConfig will use
        let signer = anvil.keys()[0].clone();
        let signer_hex = signer.to_bytes().encode_hex();
        let tmp_dir = tempfile::tempdir().unwrap();
        let key_path = tmp_dir.path().join("key");
        std::fs::write(&key_path, signer_hex).unwrap();

        // Ensure block timestamps increase per mined block (1s interval)
        let _ = rpc_call(
            anvil.endpoint().as_str(),
            "anvil_setBlockTimestampInterval",
            serde_json::json!([1]),
        )
        .await;

        // Minimal feeds config with a single feed so resync has keys to refresh
        let feed = test_feed_config(13, 0);
        let feeds_config = AllFeedsConfig { feeds: vec![feed] };

        let mut cfg = get_test_config_with_single_provider(
            net,
            key_path.as_path(),
            anvil.endpoint().as_str(),
        );
        // Ensure we do not auto-load indices during init to keep control in the test
        if let Some(p) = cfg.providers.get_mut(net) {
            p.should_load_rb_indices = false;
        }

        let providers = init_shared_rpc_providers(&cfg, Some("test_reorg_"), &feeds_config).await;
        let provider_mutex = providers.read().await.get(net).unwrap().clone();

        // Inject a dummy ADFS contract address so the reorg loop's root-check and resync paths are exercised
        {
            let mut provider = provider_mutex.lock().await;
            let dummy_contract_address =
                Address::from_str("0x1000000000000000000000000000000000000000").unwrap();
            provider.set_contract_address(
                blocksense_config::ADFS_CONTRACT_NAME,
                &dummy_contract_address,
            );
        }

        // 2) Seed local state: non-zero local calldata frontier and initial observed hash for height 0
        {
            let mut provider = provider_mutex.lock().await;

            // Make local frontier root non-zero so the loop triggers a resync vs on-chain (zero) root
            let dummy_leaf = alloy_primitives::keccak256([0x42u8; 32]);
            provider
                .calldata_merkle_tree_frontier
                .append(crate::providers::provider::HashValue(dummy_leaf));

            // Pre-set an rb index value to detect refresh to on-chain (expected zero)
            let encoded = EncodedFeedId::new(13u128, 0);
            provider.rb_indices.insert(encoded, 7);

            // Insert observed hash for genesis (height 0) so the first loop can progress without finalized support
            if let Ok(Some(genesis)) = provider
                .provider
                .get_block_by_number(BlockNumberOrTag::Number(0))
                .await
            {
                provider.insert_observed_block_hash(0, genesis.header.hash);
            }
        }

        // 3) Pre-mine 110 blocks by sending self txs to ensure avg block time > 0
        {
            let provider = provider_mutex.lock().await;
            mine_self_txs(&provider.provider, &provider.signer, 110)
                .await
                .expect("failed to pre-mine blocks");
        }

        // Query current tip height as T0, then snapshot the chain at T0
        let t0_height = {
            let provider = provider_mutex.lock().await;
            provider
                .provider
                .get_block_by_number(BlockNumberOrTag::Latest)
                .await
                .unwrap()
                .unwrap()
                .header
                .inner
                .number
        };
        let snapshot_id = anvil_snapshot(anvil.endpoint().as_str())
            .await
            .expect("snapshot should succeed");

        let (feed_updates_send, mut feed_updates_recv) = counted_unbounded_channel();

        // 4) Start the reorg tracking loop in background
        let loop_handle = tokio::spawn(super::loop_tracking_for_reorg_in_network(
            net.to_string(),
            providers.clone(),
            blocksense_config::ReorgConfig::default(),
            feed_updates_send,
        ));

        // Give the loop time to run once and ingest the chain
        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;

        // Produce a few more blocks so observed_latest_height advances to T1 > T0
        {
            let provider = provider_mutex.lock().await;
            mine_self_txs(&provider.provider, &provider.signer, 5)
                .await
                .expect("failed to add blocks after snapshot");
        }

        // Give it time to incorporate the new tip
        tokio::time::sleep(std::time::Duration::from_millis(1200)).await;

        // Capture current latest height (T1) and the observed hash we stored for it
        let (t1_height, observed_t1_hash) = {
            let provider = provider_mutex.lock().await;
            let latest = provider
                .provider
                .get_block_by_number(BlockNumberOrTag::Latest)
                .await
                .unwrap()
                .unwrap();
            let h = latest.header.inner.number;
            let obs = provider.inflight.observed_block_hashes.get(&h).copied();
            (h, obs)
        };

        // Ensure the tracker has recorded observed hash at T1 before inducing the reorg
        for _ in 0..20 {
            let has_observed_t1 = {
                let provider = provider_mutex.lock().await;
                provider
                    .inflight
                    .observed_block_hashes
                    .contains_key(&t1_height)
            };
            if has_observed_t1 {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }

        // Inject non-finalized updates: one before the fork (<= T0), and two after the fork (T1-1, T1)
        {
            let mut provider = provider_mutex.lock().await;
            let enc = EncodedFeedId::new(13u128, 0);
            let provider_settings = cfg.providers.get(net).unwrap().clone();
            let feeds_map: Arc<RwLock<HashMap<EncodedFeedId, FeedConfig>>> =
                Arc::new(RwLock::new(HashMap::new()));
            // Prepare three batches with block_height set to the intended heights
            let mk_batch = |bh: u64| BatchOfUpdatesToProcess {
                net: net.to_string(),
                provider: provider_mutex.clone(),
                provider_settings: provider_settings.clone(),
                updates: BatchedAggregatesToSend {
                    block_height: 0, // cross-chain height; not used for asserting network key
                    updates: vec![blocksense_data_feeds::feeds_processing::VotedFeedUpdate {
                        encoded_feed_id: EncodedFeedId::new(bh as u128, 0),
                        value: blocksense_feed_registry::types::FeedType::Text(format!(
                            "marker_for_height_{bh}"
                        )),
                        end_slot_timestamp: 0u128,
                    }],
                },
                feeds_config: feeds_map.clone(),
                transaction_retry_timeout_secs: 3,
                transaction_retries_count_limit: 1,
                retry_fee_increment_fraction: 0.1,
            };
            // Insert at T0 (pre-fork, should NOT be reintroduced)
            provider
                .inflight
                .insert_non_finalized_update(t0_height, mk_batch(t0_height));
            // Insert at T1 and T1-1 (post-fork, should be reintroduced)
            provider
                .inflight
                .insert_non_finalized_update(t1_height, mk_batch(t1_height));
            if t1_height > 0 {
                provider
                    .inflight
                    .insert_non_finalized_update(t1_height - 1, mk_batch(t1_height - 1));
            }
            // Also ensure the feed index map has our key
            provider.rb_indices.insert(enc, 7);
        }

        // 5) Revert to the snapshot (T0) and mine a different branch beyond T1
        anvil_revert(anvil.endpoint().as_str(), snapshot_id.as_str())
            .await
            .expect("revert should succeed");

        // Mine enough blocks to surpass T1 + 1 on the new branch
        {
            let provider = provider_mutex.lock().await;
            // First, mine the first 10 blocks with a different gas price so that
            // blocks [T0+1..T0+10] differ from the previously observed chain.
            mine_varied_txs(&provider.provider, &provider.signer, 10, 2_000_000_000u128)
                .await
                .expect("failed to mine on new branch (differing blocks)");
            // Then mine additional blocks to move the tip clearly beyond T1, but keep
            // total < 64 so finalized (latest-64) remains below ~110
            mine_self_txs(&provider.provider, &provider.signer, 40)
                .await
                .expect("failed to mine on new branch");
        }

        // Let the loop observe the new branch and trigger resync
        tokio::time::sleep(std::time::Duration::from_millis(2000)).await;

        // 6) Assert reorg happened (chain hash at T1 changed vs previously observed)
        let chain_t1_hash = {
            let provider = provider_mutex.lock().await;
            provider
                .provider
                .get_block_by_number(BlockNumberOrTag::Number(t1_height))
                .await
                .unwrap()
                .unwrap()
                .header
                .hash
        };
        if let Some(prev_obs) = observed_t1_hash {
            assert_ne!(
                chain_t1_hash, prev_obs,
                "Chain did not diverge at height {} as expected",
                t1_height
            );
        }

        // 7) Assert indices resync was initiated: merkle_root_in_contract is set from chain (zero) and rb_indices refreshed
        {
            let provider = provider_mutex.lock().await;
            assert!(
                provider.get_latest_contract().is_some(),
                "Expected ADFS contract to be present in provider config"
            );
        }
        // Give the loop a bit more time to run the resync path if needed
        for _ in 0..10 {
            {
                let provider = provider_mutex.lock().await;
                if provider.merkle_root_in_contract.is_some() {
                    break;
                }
            }
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }
        {
            let provider = provider_mutex.lock().await;
            let root = provider.merkle_root_in_contract.clone();
            assert!(
                root.is_some(),
                "Expected merkle_root_in_contract to be set by resync loop"
            );
            // On empty address storage, root is zero
            assert_eq!(
                root.unwrap().0,
                B256::ZERO,
                "Expected on-chain root to be zero"
            );

            let idx = provider
                .rb_indices
                .get(&EncodedFeedId::new(13u128, 0))
                .copied();
            assert_eq!(
                idx,
                Some(0),
                "Expected rb index for the feed to be refreshed from chain (default 0)"
            );
        }

        // Wait until the reorg metric increments to confirm detection
        for _ in 0..100 {
            let count = {
                let provider_metrics = {
                    let provider = provider_mutex.lock().await;
                    provider.provider_metrics.clone()
                };
                let metrics = provider_metrics.read().await;
                metrics.observed_reorgs.with_label_values(&[net]).get()
            };
            if count > 0 {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }
        {
            let provider_metrics = {
                let provider = provider_mutex.lock().await;
                provider.provider_metrics.clone()
            };
            let metrics = provider_metrics.read().await;
            let count = metrics.observed_reorgs.with_label_values(&[net]).get();
            assert!(count > 0, "Expected at least one reorg to be detected");
        }

        // 8) Drain relayer channel and assert only post-fork updates were reintroduced
        // Expect exactly the two batches for heights T1-1 and T1, none for T0.
        let mut received_heights = Vec::new();
        // Allow generous time for messages to arrive to avoid flakiness
        for _ in 0..20 {
            if let Ok(Some(batch)) =
                tokio::time::timeout(std::time::Duration::from_secs(1), feed_updates_recv.recv())
                    .await
            {
                // Decode the marker we embedded via encoded_feed_id = height
                if let Some(vu) = batch.updates.updates.first() {
                    received_heights.push(vu.encoded_feed_id.get_id());
                }
                if received_heights.len() >= 2 {
                    break;
                }
            } else {
                break;
            }
        }
        received_heights.sort_unstable();
        let expected: Vec<u128> = if t1_height > 0 {
            vec![(t1_height - 1) as u128, t1_height as u128]
        } else {
            vec![t1_height as u128]
        };
        assert_eq!(
            received_heights, expected,
            "Expected only post-fork updates to be reintroduced"
        );
        assert!(
            !received_heights.contains(&(t0_height as u128)),
            "Did not expect pre-fork update to be reintroduced"
        );

        // 9) Assert pre-fork update remains in inflight map
        {
            let provider = provider_mutex.lock().await;
            assert!(
                provider
                    .inflight
                    .non_finalized_updates
                    .contains_key(&t0_height),
                "Expected pre-fork non-finalized update at T0 to remain in inflight.NON-finalized"
            );
        }

        // 10) Mine 30 more blocks so finalized surpasses 110 and ensure the pre-fork update is pruned
        {
            let provider = provider_mutex.lock().await;
            mine_self_txs(&provider.provider, &provider.signer, 30)
                .await
                .expect("failed to mine additional blocks to advance finalization");
        }
        // Allow the loop to observe new finalized height and perform pruning
        for _ in 0..20 {
            {
                let provider = provider_mutex.lock().await;
                if !provider
                    .inflight
                    .non_finalized_updates
                    .contains_key(&t0_height)
                {
                    break;
                }
            }
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }
        {
            let provider = provider_mutex.lock().await;
            assert!(
                !provider
                    .inflight
                    .non_finalized_updates
                    .contains_key(&t0_height),
                "Expected pre-fork non-finalized update at T0 to be pruned once finalized surpassed it"
            );
        }

        // Abort the loop to finish the test
        loop_handle.abort();
    }
}
