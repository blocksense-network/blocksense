use actix_web::{rt::time::interval, web::Data};
use alloy::{
    hex,
    network::TransactionBuilder,
    primitives::{Address, Bytes},
    providers::{Provider, ProviderBuilder},
    rpc::types::{eth::TransactionRequest, TransactionReceipt},
};
use alloy_primitives::{keccak256, B256, U256};
use blocksense_config::{FeedStrideAndDecimals, ReorgConfig, GNOSIS_SAFE_CONTRACT_NAME};
use blocksense_data_feeds::feeds_processing::{BatchedAggregatesToSend, VotedFeedUpdate};
use blocksense_registry::config::FeedConfig;
use blocksense_utils::{counter_unbounded_channel::CountedReceiver, EncodedFeedId};
use eyre::{bail, eyre, Result};
use std::{collections::HashMap, collections::HashSet, mem, sync::Arc};
use tokio::{
    sync::{Mutex, RwLock},
    time::Duration,
};

use crate::{
    providers::{
        provider::{
            parse_eth_address, HashValue, LatestRBIndex, ProviderStatus, ProviderType,
            ProvidersMetrics, RpcProvider, SharedRpcProviders,
        },
        reorg_tracking::loop_tracking_for_reorg_in_network,
    },
    sequencer_state::SequencerState,
};
use blocksense_feeds_processing::adfs_gen_calldata::{
    adfs_serialize_updates, get_neighbour_feed_ids, RoundBufferIndices,
};
use blocksense_metrics::{
    dec_metric, inc_metric, inc_vec_metric,
    metrics::{FeedsMetrics, ProviderMetrics},
    process_provider_getter, set_metric,
};
use paste::paste;
use std::time::Instant;
use tracing::{debug, error, info, info_span, warn};

use futures_util::stream::FuturesUnordered;
use std::io::Error;
use tokio::task::JoinHandle;

pub async fn deploy_contract(
    network: &String,
    providers: &SharedRpcProviders,
    contract_name: &str,
) -> Result<String> {
    let providers = providers.read().await;
    let provider = providers.get(network);
    let Some(p) = provider.cloned() else {
        return Err(eyre!("No provider for network {}", network));
    };
    drop(providers);
    let mut p = p.lock().await;
    p.deploy_contract(contract_name).await
}

/// If `allowed_feed_ids` is specified only the feeds from `updates` that are allowed
/// will be added to the result. Otherwise, all feeds in `updates` will be added.
pub fn filter_allowed_feeds(
    net: &str,
    updates: &mut BatchedAggregatesToSend,
    allow_feeds: &Option<Vec<EncodedFeedId>>,
) {
    if let Some(allowed_feed_ids) = allow_feeds {
        let mut res: Vec<VotedFeedUpdate> = vec![];
        for u in &updates.updates {
            let encoded_feed_id = u.encoded_feed_id;
            if allowed_feed_ids.is_empty() || allowed_feed_ids.contains(&encoded_feed_id) {
                res.push(u.clone());
            } else {
                debug!("Skipping encoded_feed_id {encoded_feed_id} for special network `{net}`");
            }
        }
        updates.updates = mem::take(&mut res);
    }
}

// Will reduce the updates to only the relevant for the network
pub async fn get_serialized_updates_for_network(
    net: &str,
    provider_mutex: &Arc<Mutex<RpcProvider>>,
    updates: &mut BatchedAggregatesToSend,
    provider_settings: &blocksense_config::Provider,
    feeds_config: Arc<RwLock<HashMap<EncodedFeedId, FeedConfig>>>,
    feeds_rb_indices: &mut HashMap<EncodedFeedId, u64>,
) -> Result<Vec<u8>> {
    debug!("Acquiring a read lock on provider config for `{net}`");
    let provider = provider_mutex.lock().await;
    debug!("Acquired a read lock on provider config for `{net}`");
    filter_allowed_feeds(net, updates, &provider_settings.allow_feeds);
    provider.peg_stable_coins_to_value(updates);
    provider.apply_publish_criteria(updates, net);

    // Don’t post to Smart Contract if we have 0 updates
    if updates.updates.is_empty() {
        return Ok(Vec::new());
    }

    drop(provider);
    debug!("Released a read lock on provider config for `{net}`");

    let mut strides_and_decimals = HashMap::new();
    let mut relevant_feed_ids = HashSet::new();

    for update in updates.updates.iter() {
        relevant_feed_ids.extend(get_neighbour_feed_ids(update.encoded_feed_id));
    }

    for feed_id in relevant_feed_ids.iter() {
        debug!("Acquiring a read lock on feeds_config; network={net}; feed_id={feed_id}");
        let feed_config = feeds_config.read().await.get(feed_id).cloned();
        debug!(
            "Acquired and released a read lock on feeds_config; network={net}; feed_id={feed_id}"
        );

        strides_and_decimals.insert(
            *feed_id,
            FeedStrideAndDecimals::from_feed_config(&feed_config),
        );
    }

    let serialized_updates = {
        let provider = provider_mutex.lock().await;
        match adfs_serialize_updates(
            net,
            updates,
            Some(&provider.rb_indices),
            strides_and_decimals,
            feeds_rb_indices,
        )
        .await
        {
            Ok(bytes) => {
                debug!(
                    "adfs_serialize_updates result for network {} and block height {} = {}",
                    net,
                    updates.block_height,
                    hex::encode(&bytes)
                );
                bytes
            }
            Err(e) => bail!("ADFS serialization failed: {e}!"),
        }
    };

    Ok(serialized_updates)
}

#[derive(Clone)]
pub struct BatchOfUpdatesToProcess {
    pub net: String,
    pub provider: Arc<Mutex<RpcProvider>>,
    pub provider_settings: blocksense_config::Provider,
    pub updates: BatchedAggregatesToSend,
    pub feeds_config: Arc<RwLock<HashMap<EncodedFeedId, FeedConfig>>>,
    pub transaction_retry_timeout_secs: u64,
    pub transaction_retries_count_limit: u64,
    pub retry_fee_increment_fraction: f64,
}

pub async fn create_and_collect_relayers_futures(
    collected_futures: &FuturesUnordered<JoinHandle<Result<(), Error>>>,
    feeds_metrics: Arc<RwLock<FeedsMetrics>>,
    provider_status: Arc<RwLock<HashMap<String, ProviderStatus>>>,
    relayers_recv_channels: HashMap<String, CountedReceiver<BatchOfUpdatesToProcess>>,
) {
    for (net, chan) in relayers_recv_channels.into_iter() {
        let feed_metrics_clone = feeds_metrics.clone();
        let net_clone = net.clone();
        let provider_status_clone = provider_status.clone();
        let relayer_name = format!("relayer_for_network {net}");
        collected_futures.push(
            tokio::task::Builder::new()
                .name(relayer_name.clone().as_str())
                .spawn(async move {
                    loop_processing_batch_of_updates(
                        net_clone,
                        relayer_name,
                        feed_metrics_clone,
                        provider_status_clone,
                        chan,
                    )
                    .await;
                    Ok(())
                })
                .expect("Failed to spawn {net} network relayer loop!"),
        );
    }
}

pub async fn loop_processing_batch_of_updates(
    net: String,
    relayer_name: String,
    feeds_metrics: Arc<RwLock<FeedsMetrics>>,
    provider_status: Arc<RwLock<HashMap<String, ProviderStatus>>>,
    mut chan: CountedReceiver<BatchOfUpdatesToProcess>,
) {
    tracing::info!("Starting {relayer_name} loop...");

    //TODO: Create a termination reason pattern in the future. At this point networks are not added/removed dynamically in the sequencer,
    // therefore the loop is iterating over the lifetime of the sequencer.
    loop {
        let cmd_opt = chan.recv().await;
        let msgs_in_queue = chan.len();
        match cmd_opt {
            Some(cmd) => {
                let block_height = cmd.updates.block_height;
                tracing::info!("Processing updates for network {relayer_name}, block_height {block_height}, messages in queue = {msgs_in_queue}");
                let provider = cmd.provider.clone();
                let result = eth_batch_send_to_contract(cmd).await;

                let provider_metrics = provider.lock().await.provider_metrics.clone();
                dec_metric!(provider_metrics, net, num_transactions_in_queue);
                inc_metric!(provider_metrics, net, total_tx_sent);

                match result {
                    Ok((status, updated_feeds)) => {
                        let mut result_str = String::new();
                        result_str += &format!("result from network {net} and block height {block_height}: Ok -> status: {status}");
                        if status == "true" {
                            result_str += &format!(", updated_feeds: {updated_feeds:?}");
                            increment_feeds_rb_metrics(
                                &updated_feeds,
                                Some(feeds_metrics.clone()),
                                net.as_str(),
                            )
                            .await;
                            {
                                let provider = provider.lock().await;
                                let provider_metrics = &provider.provider_metrics;
                                inc_metric!(provider_metrics, net, success_send_tx);
                            }
                            let mut status_map = provider_status.write().await;
                            status_map.insert(net.clone(), ProviderStatus::LastUpdateSucceeded);
                        } else if status == "false" || status == "timeout" {
                            let mut provider = provider.lock().await;
                            result_str += &format!(
                                ", failed to update feeds: {updated_feeds:?} due to {status}"
                            );
                            decrement_feed_rb_indices(&updated_feeds, net.as_str(), &mut provider)
                                .await;

                            let provider_metrics = &provider.provider_metrics;
                            if status == "timeout" {
                                inc_metric!(provider_metrics, net, total_timed_out_tx);
                            } else if status == "false" {
                                inc_metric!(provider_metrics, net, failed_send_tx);
                            }
                            let mut status_map = provider_status.write().await;
                            status_map.insert(net.clone(), ProviderStatus::LastUpdateFailed);
                        }
                        info!({ result_str });
                    }
                    Err(e) => {
                        error!(
                        "Got error sending to network {net} and block height {block_height}: {e}"
                    );
                    }
                }
            }
            None => warn!("Relayer {relayer_name} woke up on empty channel"),
        }
    }
}

pub async fn create_per_network_reorg_trackers(
    collected_futures: &FuturesUnordered<JoinHandle<Result<(), Error>>>,
    sequencer_state: Data<SequencerState>,
) {
    let providers_mutex = sequencer_state.providers.clone();
    let providers = providers_mutex.read().await;

    for (net, _p) in providers.iter() {
        let reorg_trackers_name = format!("reorg_tracker for {net}");
        let net_clone = net.clone();
        let sequencer_state_providers_clone = sequencer_state.providers.clone();
        let sequencer_config = sequencer_state.sequencer_config.read().await;
        let reorg_tracker_config = match sequencer_config.providers.get(net.as_str()) {
            Some(c) => c.reorg.clone(),
            None => {
                error!("No config for provider for network {net} will set to default!");
                ReorgConfig::default()
            }
        };
        collected_futures.push(
            tokio::task::Builder::new()
                .name(reorg_trackers_name.clone().as_str())
                .spawn(async move {
                    loop_tracking_for_reorg_in_network(
                        net_clone,
                        sequencer_state_providers_clone,
                        reorg_tracker_config,
                    )
                    .await;
                    Ok(())
                })
                .expect("Failed to spawn tracker for reorgs loop in network {net}!"),
        );
    }
}

#[allow(clippy::too_many_arguments)]
pub async fn eth_batch_send_to_contract(
    cmd: BatchOfUpdatesToProcess,
) -> Result<(String, Vec<EncodedFeedId>)> {
    let net = cmd.net.clone();
    let provider_mutex = cmd.provider.clone();
    let provider_settings = cmd.provider_settings.clone();
    let feeds_config = cmd.feeds_config.clone();
    let transaction_retry_timeout_secs = cmd.transaction_retry_timeout_secs;
    let transaction_retries_count_limit = cmd.transaction_retries_count_limit;
    let retry_fee_increment_fraction = cmd.retry_fee_increment_fraction;
    let mut updates = cmd.updates.clone();
    let mut feeds_rb_indices = HashMap::new();
    let serialized_updates = get_serialized_updates_for_network(
        net.as_str(),
        &provider_mutex,
        &mut updates,
        &provider_settings,
        feeds_config,
        &mut feeds_rb_indices,
    )
    .await?;

    let block_height = updates.block_height;

    if updates.updates.is_empty() {
        info!("Posting to smart contract for network `{net}` block height {block_height} skipped because it received 0 updates");
        return Ok((
            format!("No updates to send for network `{net}` block height {block_height}"),
            Vec::new(),
        ));
    }

    debug!(
        "About to post {} updates to smart contract for network `{net}`",
        updates.updates.len()
    );

    debug!("Acquiring a read/write lock on provider state for network `{net}` block height {block_height}");
    let mut provider = provider_mutex.lock().await;
    debug!("Acquired a read/write lock on provider state for network `{net}` block height {block_height}");

    let feeds_to_update_ids: Vec<EncodedFeedId> = updates
        .updates
        .iter()
        .map(|update| update.encoded_feed_id)
        .collect();

    increment_feeds_rb_indices(&feeds_to_update_ids, net.as_str(), &mut provider).await;

    let signer = &provider.signer;
    let contract_address = if let Some(contract) = provider.get_latest_contract() {
        if let Some(contract_address) = contract.address {
            contract_address
        } else {
            return Err(eyre!(
                "No publishing contract address is set for network {net}"
            ));
        }
    } else {
        return Err(eyre!(
            "No publishing contract is deployed for network {net}"
        ));
    };
    info!(
        "sending data to address `{}` in network `{}` block height {block_height}",
        contract_address, net
    );

    let provider_metrics = &provider.provider_metrics;
    let rpc_handle = &provider.provider;

    let mut input = Bytes::from(serialized_updates.clone());

    let latest_call_data_hash = keccak256(input.as_ref());

    let mut next_calldata_merkle_tree = provider.calldata_merkle_tree_frontier.clone();
    next_calldata_merkle_tree.append(HashValue(latest_call_data_hash));

    let prev_calldata_merkle_tree_root = match &provider.merkle_root_in_contract {
        Some(stored_hash) => stored_hash.clone(),
        None => provider.calldata_merkle_tree_frontier.root(),
    };
    let next_calldata_merkle_tree_root = next_calldata_merkle_tree.root();

    // Merkle tree over all call data management for ADFS contracts.
    let serialized_updates = [
        vec![1],
        prev_calldata_merkle_tree_root.0.to_vec(),
        next_calldata_merkle_tree_root.0.to_vec(),
        serialized_updates,
    ]
    .concat();

    input = Bytes::from(serialized_updates);

    let receipt;
    let tx_time = Instant::now();

    let (sender_address, is_impersonated) = match &provider_settings.impersonated_anvil_account {
        Some(impersonated_anvil_account) => {
            debug!(
                "Using impersonated anvil account with address: {} in network `{net}` block height {block_height}",
                impersonated_anvil_account
            );
            (parse_eth_address(impersonated_anvil_account).unwrap(), true)
        }
        None => {
            debug!(
                "Using signer address: {} in network `{net}` block height {block_height}",
                signer.address()
            );
            (signer.address(), false)
        }
    };

    let mut transaction_retries_count = 0;
    let mut nonce_get_retries_count = 0;
    const BACKOFF_SECS: u64 = 1;

    // First get the correct nonce
    let nonce = loop {
        if nonce_get_retries_count > transaction_retries_count_limit {
            return Ok(("timeout".to_string(), feeds_to_update_ids));
        }

        let nonce = match get_nonce(
            &net,
            rpc_handle,
            &sender_address,
            block_height,
            transaction_retry_timeout_secs,
            false,
        )
        .await
        {
            Ok(n) => n,
            Err(e) => {
                warn!("{e}");
                inc_retries_with_backoff(
                    net.as_str(),
                    &mut nonce_get_retries_count,
                    provider_metrics,
                    BACKOFF_SECS,
                )
                .await;
                continue;
            }
        };
        break nonce;
    };

    let mut inclusion_block = None;
    let mut inclusion_block_hash: Option<B256> = None;

    loop {
        debug!("loop begin; transaction_retries_count={transaction_retries_count} in network `{net}` block height {block_height} with transaction_retries_count_limit = {transaction_retries_count_limit} and transaction_retry_timeout_secs = {transaction_retry_timeout_secs}");

        if transaction_retries_count > transaction_retries_count_limit {
            return Ok(("timeout".to_string(), feeds_to_update_ids));
        }

        let latest_nonce = match get_nonce(
            &net,
            rpc_handle,
            &sender_address,
            block_height,
            transaction_retry_timeout_secs,
            false,
        )
        .await
        {
            Ok(latest_nonce) => {
                if latest_nonce > nonce {
                    // If the nonce in the contract increased and the next state root hash is not as we expect,
                    // another sequencer was able to post updates for the current block height before this one.
                    // We need to take this into account and reread the round counters of the feeds.
                    info!("Updates to contract already posted, network {net}, block_height {block_height}, latest_nonce {latest_nonce}, previous_nonce {nonce}, merkle_root in contract {prev_calldata_merkle_tree_root:?}");
                    try_to_sync(
                        net.as_str(),
                        &mut provider,
                        &contract_address,
                        Some(&next_calldata_merkle_tree_root),
                    )
                    .await;
                    return Ok(("true".to_string(), feeds_to_update_ids));
                }
                latest_nonce
            }
            Err(err) => {
                warn!("{err}");
                inc_retries_with_backoff(
                    net.as_str(),
                    &mut transaction_retries_count,
                    provider_metrics,
                    BACKOFF_SECS,
                )
                .await;
                continue;
            }
        };

        let gas_price = match get_gas_price(
            net.as_str(),
            &provider,
            &updates,
            transaction_retry_timeout_secs,
        )
        .await
        {
            Ok(v) => {
                debug!("Successfully got value in network `{net}` block height {block_height} for gas_price");
                v
            }
            Err(err) => {
                warn!("get_gas_price error {err} for {transaction_retries_count}-th time in network `{net}` block height {block_height}");
                inc_retries_with_backoff(
                    net.as_str(),
                    &mut transaction_retries_count,
                    provider_metrics,
                    BACKOFF_SECS,
                )
                .await;
                continue;
            }
        };

        set_metric!(provider_metrics, net, gas_price, gas_price);

        let chain_id = match get_chain_id(
            net.as_str(),
            &provider,
            &updates,
            transaction_retry_timeout_secs,
        )
        .await
        {
            Ok(v) => {
                debug!("Successfully got value in network `{net}` block height {block_height} for chain_id");
                v
            }
            Err(err) => {
                warn!("get_chain_id error {err} for {transaction_retries_count}-th time in network `{net}` block height {block_height}");
                inc_retries_with_backoff(
                    net.as_str(),
                    &mut transaction_retries_count,
                    provider_metrics,
                    BACKOFF_SECS,
                )
                .await;
                continue;
            }
        };

        let gas_fees = match get_tx_retry_params(
            net.as_str(),
            rpc_handle,
            provider_metrics,
            &sender_address,
            transaction_retry_timeout_secs,
            transaction_retries_count,
            retry_fee_increment_fraction,
        )
        .await
        {
            Ok(res) => res,
            Err(e) => {
                let block_height = updates.block_height;
                warn!("Timed out on get_tx_retry_params for {transaction_retries_count}-th time in network `{net}` block height {block_height}: {e}!");
                inc_retries_with_backoff(
                    net.as_str(),
                    &mut transaction_retries_count,
                    provider_metrics,
                    BACKOFF_SECS,
                )
                .await;
                continue;
            }
        };

        let mut tx = TransactionRequest::default()
            .to(contract_address)
            .with_nonce(nonce)
            .with_from(sender_address)
            .with_chain_id(chain_id)
            .input(Some(input.clone()).into());

        let gas_limit = get_gas_limit(
            net.as_str(),
            rpc_handle,
            &tx,
            transaction_retry_timeout_secs,
        )
        .await;

        tx = tx.with_gas_limit(gas_limit);

        match gas_fees {
            GasFees::Legacy(gas_price) => {
                tx = tx.with_gas_price(gas_price.gas_price).transaction_type(0);
            }
            GasFees::Eip1559(eip1559_gas_fees) => {
                tx = tx
                    .with_max_priority_fee_per_gas(eip1559_gas_fees.priority_fee)
                    .with_max_fee_per_gas(eip1559_gas_fees.max_fee_per_gas);
            }
        }

        if transaction_retries_count == 0 {
            debug!("Sending initial tx: {tx:?} in network `{net}` block height {block_height}");
        } else {
            debug!("Retrying for {transaction_retries_count}-th time in network `{net}` block height {block_height} tx: {tx:?}");
        }

        let tx_receipt = {
            let rpc_impersonated_handle;
            let send_transaction_future = if is_impersonated {
                let rpc_impersonated_url = provider.url();
                rpc_impersonated_handle = ProviderBuilder::new().connect_http(rpc_impersonated_url);
                debug!("Sending impersonated price feed update transaction in network `{net}` block height {block_height}...");
                rpc_impersonated_handle.send_transaction(tx)
            } else {
                rpc_handle.send_transaction(tx)
            };
            let tx_hash_result = match actix_web::rt::time::timeout(
                Duration::from_secs(transaction_retry_timeout_secs),
                send_transaction_future,
            )
            .await
            {
                Ok(r) => match r {
                    Ok(tx_builder) => {
                        debug!("Successfully submitted for {transaction_retries_count}-th time transaction in network `{net}` block height {block_height} tx_hash = {}", tx_builder.tx_hash());
                        tx_builder
                    }
                    Err(err) => {
                        warn!("Error while submitting transaction in network `{net}` block height {block_height} and address {sender_address} due to {err}");
                        if err.to_string().contains("execution revert") {
                            info!("Trying to sync due to tx revert, network {net}, block_height {block_height}, latest_nonce {latest_nonce}, previous_nonce {nonce}, merkle_root in contract {prev_calldata_merkle_tree_root:?}");
                            try_to_sync(
                                net.as_str(),
                                &mut provider,
                                &contract_address,
                                Some(&next_calldata_merkle_tree_root),
                            )
                            .await;
                            return Ok(("false".to_string(), feeds_to_update_ids));
                        } else {
                            inc_retries_with_backoff(
                                net.as_str(),
                                &mut transaction_retries_count,
                                provider_metrics,
                                BACKOFF_SECS,
                            )
                            .await;
                            continue;
                        }
                    }
                },
                Err(err) => {
                    warn!("Error timeout while submitting transaction in network `{net}` block height {block_height} and address {sender_address} due to {err}");
                    inc_retries_with_backoff(
                        net.as_str(),
                        &mut transaction_retries_count,
                        provider_metrics,
                        BACKOFF_SECS,
                    )
                    .await;
                    continue;
                }
            };

            let tx_hash = *tx_hash_result.tx_hash();

            let tx_receipt = match tx_hash_result
                .with_timeout(Some(std::time::Duration::from_secs(
                    transaction_retry_timeout_secs,
                )))
                .get_receipt()
                .await
            {
                Ok(v) => {
                    debug!("Successfully got receipt from RPC in network `{net}` block height {block_height} and address {sender_address} tx_hash = {tx_hash} receipt = {v:?}");
                    inc_metric!(provider_metrics, net, success_get_receipt);
                    v
                }
                Err(err) => {
                    debug!("Timed out while trying to post tx to RPC and get tx_hash in network `{net}` block height {block_height} and address {sender_address} due to {err} and will try again");

                    match actix_web::rt::time::timeout(
                        Duration::from_secs(transaction_retry_timeout_secs),
                        rpc_handle.get_transaction_receipt(tx_hash),
                    )
                    .await
                    {
                        Ok(v) => match v {
                            Ok(v) => match v {
                                Some(v) => {
                                    debug!("Successfully got receipt from RPC in network `{net}` block height {block_height} and address {sender_address} tx_hash = {tx_hash} receipt = {v:?}");
                                    inc_metric!(provider_metrics, net, success_get_receipt);
                                    v
                                }
                                None => {
                                    warn!("Get tx_receipt returned None in network `{net}` block height {block_height}");
                                    inc_metric!(provider_metrics, net, failed_get_receipt);
                                    inc_retries_with_backoff(
                                        net.as_str(),
                                        &mut transaction_retries_count,
                                        provider_metrics,
                                        BACKOFF_SECS,
                                    )
                                    .await;
                                    continue;
                                }
                            },
                            Err(err) => {
                                warn!("Error getting tx_receipt in network `{net}` block height {block_height}: {err}");
                                inc_metric!(provider_metrics, net, failed_get_receipt);
                                inc_retries_with_backoff(
                                    net.as_str(),
                                    &mut transaction_retries_count,
                                    provider_metrics,
                                    BACKOFF_SECS,
                                )
                                .await;
                                continue;
                            }
                        },
                        Err(e) => {
                            warn!("Timed out while trying to get receipt for tx_hash={tx_hash} in network `{net}` block height {block_height}: {e}");
                            inc_metric!(provider_metrics, net, failed_get_receipt);
                            inc_retries_with_backoff(
                                net.as_str(),
                                &mut transaction_retries_count,
                                provider_metrics,
                                BACKOFF_SECS,
                            )
                            .await;
                            continue;
                        }
                    }
                }
            };

            info!("Successfully posted tx to RPC and got tx_hash in network `{net}` block height {block_height} and address {sender_address} tx_hash = {tx_hash}");

            tx_receipt
        };

        if let Some(eth_block_number) = tx_receipt.block_number {
            info!("Transaction was included in block #{}", eth_block_number);
            inclusion_block = Some(eth_block_number);
            if let Some(h) = tx_receipt.block_hash {
                inclusion_block_hash = Some(h);
            } else {
                error!("Receipt has no block hash!");
            }
        } else {
            error!("Receipt has no block number!");
        }

        let tx_result_str = format!("{tx_receipt:?}");
        debug!("tx_result_str={tx_result_str} in network `{net}` block height {block_height}");

        receipt = tx_receipt;

        break;
    }

    let transaction_time = tx_time.elapsed().as_millis();
    info!(
        "Recvd transaction receipt that took {}ms for {transaction_retries_count} retries in network `{}` block height {}: {:?}",
        transaction_time, net, block_height, receipt
    );

    log_gas_used(&net, &receipt, transaction_time, provider_metrics).await;

    if let Some(b) = inclusion_block {
        provider.insert_non_finalized_update(b, cmd);
        if let Some(h) = inclusion_block_hash {
            provider.insert_observed_block_hash(b, h);
        }
    }
    provider.update_history(&updates.updates);
    let result = receipt.status().to_string();
    if result == "true" {
        //Transaction was successfully confirmed therefore we update the latest state hash
        let root = next_calldata_merkle_tree.root();
        provider.calldata_merkle_tree_frontier = next_calldata_merkle_tree;
        provider.merkle_root_in_contract = None;
        debug!("Successfully updated contract in network `{net}` block height {block_height} Merkle root {root:?}");
    } // TODO: Reread round counters + latest state hash from contract
    drop(provider);
    debug!("Released a read/write lock on provider state in network `{net}` block height {block_height}");

    Ok((result, feeds_to_update_ids))
}

pub async fn get_gas_limit(
    net: &str,
    rpc_handle: &ProviderType,
    tx: &TransactionRequest,
    transaction_retry_timeout_secs: u64,
) -> u64 {
    let default_gas_limit = 10_000_000;
    match actix_web::rt::time::timeout(
        Duration::from_secs(transaction_retry_timeout_secs),
        rpc_handle.estimate_gas(tx.clone()),
    )
    .await
    {
        Ok(gas_limit_result) => match gas_limit_result {
            Ok(gas_limit) => {
                debug!("Got gas_limit={gas_limit} for network {net}");
                gas_limit * 2
            }
            Err(err) => {
                debug!("Failed to get gas_limit for network {net} due to {err}");
                default_gas_limit
            }
        },
        Err(err) => {
            warn!("Timed out while getting gas_limit for network {net} due to {err}");
            default_gas_limit
        }
    }
}

pub(crate) async fn try_to_sync(
    net: &str,
    provider: &mut RpcProvider,
    contract_address: &Address,
    next_calldata_merkle_tree_root: Option<&HashValue>,
) {
    let rpc_handle = &provider.provider;
    match rpc_handle
        .get_storage_at(*contract_address, U256::from(0))
        .await
    {
        Ok(root) => {
            if next_calldata_merkle_tree_root.is_none_or(|val| root != val.0.into()) {
                provider.merkle_root_in_contract = Some(HashValue(root.into()));
                let keys: Vec<EncodedFeedId> = if provider.rb_indices.is_empty() {
                    provider.feeds_variants.keys().cloned().collect()
                } else {
                    provider.rb_indices.keys().cloned().collect()
                };

                let mut new_indices = provider.rb_indices.clone();
                for encoded_feed_id in keys {
                    match provider.get_latest_rb_index(&encoded_feed_id).await {
                        Ok(LatestRBIndex {
                            encoded_feed_id,
                            index,
                        }) => {
                            new_indices.insert(encoded_feed_id, index as u64);
                        }
                        Err(e) => {
                            warn!("Failed to refresh rb index for feed {encoded_feed_id} in network `{net}`: {e:?}");
                        }
                    }
                }
                provider.rb_indices = new_indices;
                debug!("Refreshed rb indices from chain for `{net}`");
            }
        }
        Err(e) => {
            warn!("Failed to read root from network {net} with contract address {contract_address} : {e}");
        }
    }
}

pub async fn get_nonce(
    net: &str,
    rpc_handle: &ProviderType,
    sender_address: &Address,
    block_height: u64,
    transaction_retry_timeout_secs: u64,
    pending: bool,
) -> Result<u64> {
    debug!("Getting pending={pending} nonce for network {net} and address {sender_address}...");

    let future = if pending {
        rpc_handle.get_transaction_count(*sender_address).pending()
    } else {
        rpc_handle.get_transaction_count(*sender_address).latest()
    };

    match actix_web::rt::time::timeout(Duration::from_secs(transaction_retry_timeout_secs), future)
        .await
    {
        Ok(nonce_result) => match nonce_result {
            Ok(nonce) => {
                debug!("Got nonce={nonce} pending={pending} for network `{net}` block height {block_height} and address {sender_address}");
                Ok(nonce)
            }
            Err(err) => {
                bail!("Failed to get nonce pending={pending} for network `{net}` block height {block_height} and address {sender_address} due to {err}");
            }
        },
        Err(err) => {
            bail!("Timed out while getting nonce pending={pending} for network `{net}` block height {block_height} and address {sender_address} due to {err}");
        }
    }
}

pub async fn inc_retries_with_backoff(
    net: &str,
    transaction_retries_count: &mut u64,
    provider_metrics: &Arc<RwLock<ProviderMetrics>>,
    backoff_secs: u64,
) {
    *transaction_retries_count += 1;
    inc_metric!(provider_metrics, net, total_transaction_retries);
    // Wait before sending the next request
    let time_to_await: Duration = Duration::from_secs(backoff_secs);
    let mut interval = interval(time_to_await);
    interval.tick().await;
    // The first tick completes immediately.
    interval.tick().await;
}

pub async fn get_gas_price(
    net: &str,
    provider: &RpcProvider,
    updates: &BatchedAggregatesToSend,
    transaction_retry_timeout_secs: u64,
) -> Result<u128> {
    let block_height = updates.block_height;
    let provider_metrics = &provider.provider_metrics;
    let rpc_handle = &provider.provider;

    debug!("Observing gas price (base_fee) in network `{net}` block height {block_height}...");

    let gas_price_result = match actix_web::rt::time::timeout(
        Duration::from_secs(transaction_retry_timeout_secs),
        rpc_handle.get_gas_price(),
    )
    .await
    {
        Ok(v) => v,
        Err(e) => {
            bail!("Timed out on gas_price_result for network {net}, Blocksense block height: {block_height}: {e}!");
        }
    };
    let base_fee = match process_provider_getter!(
        gas_price_result,
        net,
        provider_metrics,
        get_gas_price
    ) {
        Ok(v) => v,
        Err(err) => {
            bail!("Error while trying to get gas_price_result for network {net} Blocksense block height: {block_height} due to {err}");
        }
    };
    debug!("Observed gas price (base_fee) for network {net} = {base_fee}");

    Ok(base_fee)
}

pub async fn get_chain_id(
    net: &str,
    provider: &RpcProvider,
    updates: &BatchedAggregatesToSend,
    transaction_retry_timeout_secs: u64,
) -> Result<u64> {
    let provider_metrics = &provider.provider_metrics;
    let rpc_handle = &provider.provider;

    let chain_id_result = match actix_web::rt::time::timeout(
        Duration::from_secs(transaction_retry_timeout_secs),
        rpc_handle.get_chain_id(),
    )
    .await
    {
        Ok(v) => v,
        Err(err) => {
            let block_height = updates.block_height;
            bail!("Timed out on get chain_id for network {net} Blocksense block height: {block_height} due to {err}");
        }
    };

    debug!("Getting chain_id for network {net}...");
    let chain_id = match process_provider_getter!(
        chain_id_result,
        net,
        provider_metrics,
        get_chain_id
    ) {
        Ok(v) => v,
        Err(err) => {
            let block_height = updates.block_height;
            bail!("Error while trying to get chain_id for network {net} Blocksense block height: {block_height} due to {err}");
        }
    };

    debug!("Got chain_id={chain_id} for network {net}");
    Ok(chain_id)
}

pub async fn log_gas_used(
    net: &str,
    receipt: &TransactionReceipt,
    transaction_time: u128,
    provider_metrics: &Arc<RwLock<ProviderMetrics>>,
) {
    let gas_used_value = receipt.gas_used;
    set_metric!(provider_metrics, net, gas_used, gas_used_value);

    let effective_gas_price_value = receipt.effective_gas_price;
    set_metric!(
        provider_metrics,
        net,
        effective_gas_price,
        effective_gas_price_value
    );

    let tx_hash = receipt.transaction_hash;
    let tx_fee = (receipt.gas_used as u128) * receipt.effective_gas_price;
    let tx_fee = (tx_fee as f64) / 1e18;
    info!("Transaction with hash {tx_hash} on `{net}` cost {tx_fee} ETH");

    set_metric!(
        provider_metrics,
        net,
        transaction_confirmation_time,
        transaction_time
    );
}

pub async fn log_provider_enabled(
    net: &str,
    provider_metrics: &Arc<RwLock<ProviderMetrics>>,
    is_enabled_value: bool,
) {
    set_metric!(provider_metrics, net, is_enabled, is_enabled_value);
}

pub struct Eip1559GasFees {
    pub max_fee_per_gas: u128,
    pub priority_fee: u128,
}

pub struct GasPrice {
    pub gas_price: u128,
}

pub enum GasFees {
    Legacy(GasPrice),
    Eip1559(Eip1559GasFees),
}

pub async fn get_tx_retry_params(
    net: &str,
    rpc_handle: &ProviderType,
    provider_metrics: &Arc<RwLock<ProviderMetrics>>,
    sender_address: &Address,
    transaction_retry_timeout_secs: u64,
    transaction_retries_count: u64,
    retry_fee_increment_fraction: f64,
) -> Result<GasFees> {
    let price_increment = 1.0 + (transaction_retries_count as f64 * retry_fee_increment_fraction);

    debug!("Getting gas_price for network {net}...");
    let gas_price = match actix_web::rt::time::timeout(
        Duration::from_secs(transaction_retry_timeout_secs),
        rpc_handle.get_gas_price(),
    )
    .await
    {
        Ok(gas_price_result) => match gas_price_result {
            Ok(gas_price) => {
                inc_metric!(provider_metrics, net, success_get_gas_price);
                debug!("Got gas_price={gas_price} for network {net}");
                gas_price
            }
            Err(err) => {
                inc_metric!(provider_metrics, net, failed_get_gas_price);
                debug!("Failed to get gas_price for network {net} due to {err}");
                return Err(err.into());
            }
        },
        Err(err) => {
            inc_metric!(provider_metrics, net, failed_get_gas_price);
            warn!("Timed out while getting gas_price for network {net} and address {sender_address} due to {err}");
            bail!("Timed out");
        }
    };

    debug!("Getting priority_fee for network {net}...");
    let mut priority_fee = match actix_web::rt::time::timeout(
        Duration::from_secs(transaction_retry_timeout_secs),
        rpc_handle.get_max_priority_fee_per_gas(),
    )
    .await
    {
        Ok(priority_fee_result) => match priority_fee_result {
            Ok(priority_fee) => {
                inc_metric!(provider_metrics, net, success_get_max_priority_fee_per_gas);
                debug!("Got priority_fee={priority_fee} for network {net}");
                priority_fee
            }
            Err(err) => {
                inc_metric!(provider_metrics, net, failed_get_max_priority_fee_per_gas);
                warn!("Failed to get priority_fee for network {net} due to {err}");
                return Ok(GasFees::Legacy(GasPrice { gas_price }));
            }
        },
        Err(err) => {
            inc_metric!(provider_metrics, net, failed_get_max_priority_fee_per_gas);
            warn!("Timed out while getting priority_fee for network {net} and address {sender_address} due to {err}");
            bail!("Timed out");
        }
    };

    priority_fee = (priority_fee as f64 * price_increment) as u128;
    let mut max_fee_per_gas = gas_price + gas_price + priority_fee;
    max_fee_per_gas = (max_fee_per_gas as f64 * price_increment) as u128;

    Ok(GasFees::Eip1559(Eip1559GasFees {
        max_fee_per_gas,
        priority_fee,
    }))
}

pub async fn eth_batch_send_to_all_contracts(
    sequencer_state: &Data<SequencerState>,
    updates: &BatchedAggregatesToSend,
    providers_metrics_opt: Option<&ProvidersMetrics>,
) -> Result<()> {
    let span = info_span!("eth_batch_send_to_all_contracts");
    let _guard = span.enter();
    debug!("updates: {:?}", updates.updates);

    let mut errors_vec = Vec::new();

    // drop all the locks as soon as we are done using the data
    {
        // Locks acquired here
        debug!("Acquiring a read lock on sequencer_state.providers");
        let providers = sequencer_state.providers.read().await;
        debug!("Acquired a read lock on sequencer_state.providers");

        debug!("Acquiring a read lock on sequencer_state.sequencer_config");
        let providers_config_guard = sequencer_state.sequencer_config.read().await;
        debug!("Acquired a read lock on sequencer_state.sequencer_config");
        let providers_config = &providers_config_guard.providers;

        // No lock, we propagate the shared objects to the created futures
        let feeds_config = sequencer_state.active_feeds.clone();
        for (net, provider) in providers.iter() {
            let net = net.clone();

            if let Some(provider_settings) = providers_config.get(&net) {
                if provider_settings
                    .get_contract_config(GNOSIS_SAFE_CONTRACT_NAME)
                    .is_some()
                {
                    info!(
                        "Network `{net}` is configured for two phase consensus in sequencer; skipping direct update"
                    );
                    continue;
                }
                let is_enabled_value = provider_settings.is_enabled;

                if let Some(provider_metrics) =
                    providers_metrics_opt.and_then(|pm| pm.get(net.as_str()))
                {
                    log_provider_enabled(net.as_str(), provider_metrics, is_enabled_value).await;
                } else {
                    error!("No metrics found for network {net}");
                }

                if !is_enabled_value {
                    warn!("Network `{net}` is not enabled; skipping it during reporting");
                    continue;
                } else {
                    info!("Network `{net}` is enabled; reporting...");
                }

                let (
                    transaction_retries_count_limit,
                    transaction_retry_timeout_secs,
                    retry_fee_increment_fraction,
                ) = {
                    (
                        provider_settings.transaction_retries_count_limit as u64,
                        provider_settings.transaction_retry_timeout_secs as u64,
                        provider_settings.retry_fee_increment_fraction,
                    )
                };

                let updates = updates.clone();
                let provider = provider.clone();
                let feeds_config = feeds_config.clone();
                let provider_settings = provider_settings.clone();
                let block_height = updates.block_height;

                let batch_of_updates_to_process = BatchOfUpdatesToProcess {
                    net: net.clone(),
                    provider: provider.clone(),
                    provider_settings,
                    updates,
                    feeds_config,
                    transaction_retry_timeout_secs,
                    transaction_retries_count_limit,
                    retry_fee_increment_fraction,
                };

                {
                    let relayers = sequencer_state.relayers_send_channels.read().await;
                    let relayer_opt = relayers.get(net.as_str());
                    if let Some(relayer) = relayer_opt {
                        let msgs_in_queue = relayer.len();
                        match relayer.send(batch_of_updates_to_process) {
                            Ok(()) => {
                                debug!("Sent updates to relayer for network {net} and block height {block_height}, messages in queue = {msgs_in_queue}");
                                if let Some(provider_metrics) =
                                    providers_metrics_opt.and_then(|pm| pm.get(net.as_str()))
                                {
                                    inc_metric!(provider_metrics, net, num_transactions_in_queue);
                                } else {
                                    error!("No metrics found for network {net}");
                                }
                            }
                            Err(e) => {
                                error!("Error while sending updates to relayer for network {net} and block height {block_height}, messages in queue = {msgs_in_queue}: {e}")
                            }
                        };
                    } else {
                        let error_msg = format!("Network `{net}` has no registered relayer; skipping it during reporting");
                        errors_vec.push(error_msg);
                    }
                }
            } else {
                warn!(
                    "Network `{net}` is not configured in sequencer; skipping it during reporting"
                );
                continue;
            }
        }

        debug!("Releasing a read lock on sequencer_state.sequencer_config");
        debug!("Releasing a read lock on sequencer_state.providers");
    }
    if !errors_vec.is_empty() {
        error!("{}", errors_vec.join("; "));
    }
    Ok(())
}

async fn log_rb_indices(
    prefix: &str,
    updated_feeds: &Vec<EncodedFeedId>,
    rb_indices: &mut RoundBufferIndices,
    net: &str,
) {
    let mut debug_string =
        format!("{prefix} for net = {net} and updated_feeds = {updated_feeds:?} ");
    for feed in updated_feeds {
        let round_index = rb_indices.get(feed).unwrap_or(&0);
        debug_string.push_str(format!("{feed} = {round_index}; ").as_str());
    }
    debug!(debug_string);
}

pub async fn increment_feeds_rb_indices(
    updated_feeds: &Vec<EncodedFeedId>,
    net: &str,
    provider: &mut RpcProvider,
) {
    log_rb_indices(
        "increment_feeds_rb_indices before update",
        updated_feeds,
        &mut provider.rb_indices,
        net,
    )
    .await;

    for feed in updated_feeds {
        let round_buffer_index = provider.rb_indices.entry(*feed).or_insert(0);
        *round_buffer_index += 1;
    }

    log_rb_indices(
        "increment_feeds_rb_indices after update",
        updated_feeds,
        &mut provider.rb_indices,
        net,
    )
    .await;
}
// Since we update the round buffer index when we post the tx and before we
// receive its receipt if the tx fails we need to decrease the round indices.
pub async fn decrement_feed_rb_indices(
    updated_feeds: &Vec<EncodedFeedId>,
    net: &str,
    provider: &mut RpcProvider,
) {
    log_rb_indices(
        "decrement_feed_rb_indices before update",
        updated_feeds,
        &mut provider.rb_indices,
        net,
    )
    .await;

    for feed in updated_feeds {
        let round_buffer_index = provider.rb_indices.entry(*feed).or_insert(0);
        if *round_buffer_index > 0 {
            *round_buffer_index -= 1;
        }
    }

    log_rb_indices(
        "decrement_feed_rb_indices after update",
        updated_feeds,
        &mut provider.rb_indices,
        net,
    )
    .await;
}

async fn increment_feeds_rb_metrics(
    updated_feeds: &Vec<EncodedFeedId>,
    feeds_metrics: Option<Arc<RwLock<FeedsMetrics>>>,
    net: &str,
) {
    if let Some(ref fm) = feeds_metrics {
        for feed in updated_feeds {
            // update the count of updates to the network metrics accordingly
            inc_vec_metric!(fm, updates_to_networks, feed, net);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::providers::provider::init_shared_rpc_providers;
    use alloy::hex::ToHexExt;
    use alloy::node_bindings::Anvil;
    use alloy::primitives::Address;
    use blocksense_config::{
        get_test_config_with_single_provider, test_feed_config, ADFS_ACCESS_CONTROL_CONTRACT_NAME,
    };
    use blocksense_config::{AllFeedsConfig, PublishCriteria};
    use blocksense_data_feeds::feeds_processing::VotedFeedUpdate;

    use blocksense_utils::test_env::get_test_private_key_path;
    use blocksense_utils::FeedId;
    use rdkafka::message::ToBytes;
    use regex::Regex;
    use std::str::FromStr;

    fn extract_address(message: &str) -> Option<String> {
        let re = Regex::new(r"0x[a-fA-F0-9]{40}").expect("Invalid regex");
        if let Some(mat) = re.find(message) {
            return Some(mat.as_str().to_string());
        }
        None
    }

    #[tokio::test]
    async fn test_deploy_contract_returns_valid_address() {
        // setup
        let anvil = Anvil::new().try_spawn().unwrap();
        let network = "ETH131";
        let key_path = get_test_private_key_path();

        let mut cfg = get_test_config_with_single_provider(
            network,
            key_path.as_path(),
            anvil.endpoint().as_str(),
        );
        let p_entry = cfg.providers.entry(network.to_string());
        p_entry.and_modify(|p| {
            if let Some(x) = p
                .contracts
                .iter_mut()
                .find(|x| x.name == ADFS_ACCESS_CONTROL_CONTRACT_NAME)
            {
                x.address = None;
            }
        });
        let feeds_config = AllFeedsConfig { feeds: vec![] };
        // give some time for cleanup env variables
        let providers = init_shared_rpc_providers(
            &cfg,
            Some("test_deploy_contract_returns_valid_address_"),
            &feeds_config,
        )
        .await;

        // run
        let result = deploy_contract(
            &String::from(network),
            &providers,
            ADFS_ACCESS_CONTROL_CONTRACT_NAME,
        )
        .await;
        // assert
        // validate contract was deployed at expected address
        if let Ok(msg) = result {
            let extracted_address = extract_address(&msg);
            // Assert address was returned
            assert!(
                extracted_address.is_some(),
                "Did not return valid eth address"
            );
            // Assert we can read bytecode from that address
            let extracted_address = Address::from_str(&extracted_address.unwrap()).ok().unwrap();
            let provider = providers.read().await.get(network).unwrap().clone();
            let can_get_bytecode = provider
                .lock()
                .await
                .can_read_contract_bytecode(&extracted_address, Duration::from_secs(1))
                .await
                .expect("Timeout when trying to read from address");
            assert!(can_get_bytecode);
        } else {
            panic!("contract deployment failed")
        }
    }

    fn create_rb_index_strides_and_decimals() -> (
        std::collections::HashMap<EncodedFeedId, u64>,
        std::collections::HashMap<EncodedFeedId, blocksense_config::FeedStrideAndDecimals>,
    ) {
        let key1 = EncodedFeedId::new(0x1F as FeedId, 0);
        let key2 = EncodedFeedId::new(0x0FFF as FeedId, 0);
        let mut rb_indices = RoundBufferIndices::new();
        rb_indices.insert(key1, 7);
        rb_indices.insert(key2, 8);
        let mut strides_and_decimals = HashMap::new();
        strides_and_decimals.insert(
            key1,
            FeedStrideAndDecimals {
                stride: 0,
                decimals: 8,
            },
        );
        strides_and_decimals.insert(
            key2,
            FeedStrideAndDecimals {
                stride: 0,
                decimals: 8,
            },
        );
        (rb_indices, strides_and_decimals)
    }

    #[tokio::test]
    async fn compute_keys_vals_ignores_networks_not_on_the_list() {
        let network = "dont_filter_me";
        let mut updates = BatchedAggregatesToSend {
            block_height: 0,
            updates: get_updates_test_data(),
        };

        let (rb_indices, strides_and_decimals) = create_rb_index_strides_and_decimals();
        let mut stored_rb_indices = HashMap::new();

        filter_allowed_feeds(network, &mut updates, &None);
        let serialized_updates = adfs_serialize_updates(
            network,
            &updates,
            Some(&rb_indices),
            strides_and_decimals,
            &mut stored_rb_indices,
        )
        .await
        .expect("Could not serialize updates!");

        assert_eq!(serialized_updates.to_bytes().encode_hex(), "00000002000303e00701026869000401ffe00801036279650101000000000000000000000000000000000000000000000000000000000000000701ff0000000000000000000000000000000000000000000000000000000000000008");
    }

    use blocksense_feed_registry::types::FeedType;

    fn get_updates_test_data() -> Vec<VotedFeedUpdate> {
        //let updates = HashMap::from([("001f", "hi"), ("0fff", "bye")]);
        let end_slot_timestamp = 0_u128;
        let v1 = VotedFeedUpdate {
            encoded_feed_id: EncodedFeedId::new(0x1F as FeedId, 0),
            value: FeedType::Text("hi".to_string()),
            end_slot_timestamp,
        };
        let v2 = VotedFeedUpdate {
            encoded_feed_id: EncodedFeedId::new(0x0FFF as FeedId, 0),
            value: FeedType::Text("bye".to_string()),
            end_slot_timestamp,
        };
        let updates: Vec<VotedFeedUpdate> = vec![v1, v2];
        updates
    }

    #[tokio::test]
    async fn compute_keys_vals_filters_updates_for_networks_on_the_list() {
        // Citrea
        let network = "citrea-testnet";

        let mut updates = BatchedAggregatesToSend {
            block_height: 0,
            updates: get_updates_test_data(),
        };

        filter_allowed_feeds(
            network,
            &mut updates,
            &Some(vec![
                EncodedFeedId::new(31, 0),  // BTC/USD
                EncodedFeedId::new(47, 0),  // ETH/USD
                EncodedFeedId::new(65, 0),  // EURC/USD
                EncodedFeedId::new(236, 0), // USDT/USD
                EncodedFeedId::new(131, 0), // USDC/USD
                EncodedFeedId::new(21, 0),  // PAXG/USD
                EncodedFeedId::new(206, 0), // TBTC/USD
                EncodedFeedId::new(43, 0),  // WBTC/USD
                EncodedFeedId::new(4, 0),   // WSTETH/USD
            ]),
        );

        let (rb_indices, strides_and_decimals) = create_rb_index_strides_and_decimals();
        let mut stored_rb_indices = HashMap::new();

        let serialized_updates = adfs_serialize_updates(
            network,
            &updates,
            Some(&rb_indices),
            strides_and_decimals.clone(),
            &mut stored_rb_indices,
        )
        .await
        .expect("Could not serialize updates!");

        // Note: bye is filtered out:
        assert_eq!(
            serialized_updates.to_bytes().encode_hex(),
            "00000001000303e0070102686901010000000000000000000000000000000000000000000000000000000000000007"
        );

        // Berachain
        let network = "berachain-bartio";

        filter_allowed_feeds(
            network,
            &mut updates,
            &Some(vec![
                EncodedFeedId::new(31, 0),  // BTC/USD
                EncodedFeedId::new(47, 0),  // ETH/USD
                EncodedFeedId::new(65, 0),  // EURC/USD
                EncodedFeedId::new(236, 0), // USDT/USD
                EncodedFeedId::new(131, 0), // USDC/USD
                EncodedFeedId::new(21, 0),  // PAXG/USD
            ]),
        );

        let serialized_updates = adfs_serialize_updates(
            network,
            &updates,
            Some(&rb_indices),
            strides_and_decimals.clone(),
            &mut stored_rb_indices,
        )
        .await
        .expect("Could not serialize updates!");

        assert_eq!(
            serialized_updates.to_bytes().encode_hex(),
            "00000001000303e0070102686901010000000000000000000000000000000000000000000000000000000000000007"
        );

        // Manta
        let network = "manta-sepolia";

        filter_allowed_feeds(
            network,
            &mut updates,
            &Some(vec![
                EncodedFeedId::new(31, 0),  // BTC/USD
                EncodedFeedId::new(47, 0),  // ETH/USD
                EncodedFeedId::new(236, 0), // USDT/USD
                EncodedFeedId::new(131, 0), // USDC/USD
                EncodedFeedId::new(43, 0),  // WBTC/USD
            ]),
        );

        let serialized_updates = adfs_serialize_updates(
            network,
            &updates,
            Some(&rb_indices),
            strides_and_decimals,
            &mut stored_rb_indices,
        )
        .await
        .expect("Could not serialize updates!");

        assert_eq!(
            serialized_updates.to_bytes().encode_hex(),
            "00000001000303e0070102686901010000000000000000000000000000000000000000000000000000000000000007"
        );
    }

    fn peg_stable_coin_updates_data() -> BatchedAggregatesToSend {
        let end_slot_timestamp = 0_u128;
        let v1 = VotedFeedUpdate {
            encoded_feed_id: EncodedFeedId::new(0x1F as FeedId, 0),
            value: FeedType::Text("hi".to_string()),
            end_slot_timestamp,
        };
        let v2 = VotedFeedUpdate {
            encoded_feed_id: EncodedFeedId::new(0x0FFF as FeedId, 0),
            value: FeedType::Text("bye".to_string()),
            end_slot_timestamp,
        };
        let v3 = VotedFeedUpdate {
            encoded_feed_id: EncodedFeedId::new(0x001 as FeedId, 0),
            value: FeedType::Numerical(1.001f64),
            end_slot_timestamp,
        };

        let v4 = VotedFeedUpdate {
            encoded_feed_id: EncodedFeedId::new(0x001 as FeedId, 0),
            value: FeedType::Numerical(1.101f64),
            end_slot_timestamp,
        };
        let v5 = VotedFeedUpdate {
            encoded_feed_id: EncodedFeedId::new(0x001 as FeedId, 0),
            value: FeedType::Numerical(0.991f64),
            end_slot_timestamp,
        };

        BatchedAggregatesToSend {
            block_height: 1,
            updates: vec![v1, v2, v3, v4, v5],
        }
    }

    #[tokio::test]
    async fn peg_stable_coin_updates() {
        let network = "ETH";
        let url = "http://localhost:8545";
        let key_path = get_test_private_key_path();

        let mut sequencer_config =
            get_test_config_with_single_provider(network, key_path.as_path(), url);

        sequencer_config
            .providers
            .entry(network.to_string())
            .and_modify(|p| {
                let c = PublishCriteria {
                    encoded_feed_id: EncodedFeedId::new(1 as FeedId, 0),
                    skip_publish_if_less_then_percentage: 0.3f64,
                    always_publish_heartbeat_ms: None,
                    peg_to_value: Some(1f64),
                    peg_tolerance_percentage: 1.0f64,
                };
                p.publishing_criteria.push(c);
            });

        let feed = test_feed_config(1, 0);
        let feeds_config: AllFeedsConfig = AllFeedsConfig {
            feeds: vec![feed.clone()],
        };
        let providers = init_shared_rpc_providers(
            &sequencer_config,
            Some("peg_stable_coin_updates_"),
            &feeds_config,
        )
        .await;
        let mut prov2 = providers.write().await;
        let mut provider = prov2.get_mut(network).unwrap().lock().await;

        provider.update_history(&[VotedFeedUpdate {
            encoded_feed_id: EncodedFeedId::new(0x001 as FeedId, 0),
            value: FeedType::Numerical(1.0f64),
            end_slot_timestamp: 0_u128,
        }]);

        let mut updates = peg_stable_coin_updates_data();
        assert_eq!(updates.updates[2].value, FeedType::Numerical(1.001f64));
        provider.peg_stable_coins_to_value(&mut updates);
        assert_eq!(updates.updates.len(), 5);
        assert_eq!(updates.updates[2].value, FeedType::Numerical(1.0f64));
        assert_eq!(updates.updates[3].value, FeedType::Numerical(1.101f64));
        assert_eq!(updates.updates[4].value, FeedType::Numerical(1.0f64));

        provider.apply_publish_criteria(&mut updates, "test");
        assert_eq!(updates.updates.len(), 3);
        assert_eq!(updates.updates[2].value, FeedType::Numerical(1.101f64));
    }

    #[tokio::test]
    async fn peg_stable_coin_updates_disabled() {
        let network = "ETH";
        let url = "http://localhost:8545";
        let key_path = get_test_private_key_path();

        let mut sequencer_config =
            get_test_config_with_single_provider(network, key_path.as_path(), url);

        sequencer_config
            .providers
            .entry(network.to_string())
            .and_modify(|p| {
                let c = PublishCriteria {
                    encoded_feed_id: EncodedFeedId::new(1 as FeedId, 0),
                    skip_publish_if_less_then_percentage: 0.0f64,
                    always_publish_heartbeat_ms: None,
                    peg_to_value: None,
                    peg_tolerance_percentage: 100.0f64,
                };
                p.publishing_criteria.push(c);
            });
        let feed = test_feed_config(1, 0);
        let feeds_config: AllFeedsConfig = AllFeedsConfig {
            feeds: vec![feed.clone()],
        };
        let providers = init_shared_rpc_providers(
            &sequencer_config,
            Some("peg_stable_coin_updates_disabled"),
            &feeds_config,
        )
        .await;
        let mut prov2 = providers.write().await;
        let mut provider = prov2.get_mut(network).unwrap().lock().await;

        provider.update_history(&[VotedFeedUpdate {
            encoded_feed_id: EncodedFeedId::new(0x001 as FeedId, 0),
            value: FeedType::Numerical(1.0f64),
            end_slot_timestamp: 0_u128,
        }]);

        let mut updates = peg_stable_coin_updates_data();
        assert_eq!(updates.updates[2].value, FeedType::Numerical(1.001f64));
        provider.peg_stable_coins_to_value(&mut updates);
        assert_eq!(updates.updates.len(), 5);
        assert_eq!(updates.updates[2].value, FeedType::Numerical(1.001f64));
        assert_eq!(updates.updates[3].value, FeedType::Numerical(1.101f64));
        assert_eq!(updates.updates[4].value, FeedType::Numerical(0.991f64));

        provider.apply_publish_criteria(&mut updates, "test");
        assert_eq!(updates.updates.len(), 5);
        assert_eq!(updates.updates[3].value, FeedType::Numerical(1.101f64));
    }
}
