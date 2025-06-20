use actix_web::{rt::time::interval, web::Data};
use alloy::{
    hex,
    network::TransactionBuilder,
    primitives::{Address, Bytes},
    providers::{Provider, ProviderBuilder},
    rpc::types::{eth::TransactionRequest, TransactionReceipt},
};
use blocksense_config::FeedStrideAndDecimals;
use blocksense_data_feeds::feeds_processing::{BatchedAggegratesToSend, VotedFeedUpdate};
use blocksense_registry::config::FeedConfig;
use blocksense_utils::to_hex_string;
use eyre::{bail, eyre, Result};
use std::{collections::HashMap, collections::HashSet, mem, sync::Arc};
use tokio::{
    sync::{mpsc::UnboundedReceiver, Mutex, RwLock},
    time::Duration,
};

use crate::{
    providers::provider::{
        parse_eth_address, ProviderStatus, ProviderType, RpcProvider, SharedRpcProviders,
        EVENT_FEED_CONTRACT_NAME, PRICE_FEED_CONTRACT_NAME,
    },
    sequencer_state::SequencerState,
};
use blocksense_feed_registry::types::{Repeatability, Repeatability::Periodic};
use blocksense_feeds_processing::adfs_gen_calldata::{
    adfs_serialize_updates, get_neighbour_feed_ids, RoundCounters,
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

/// Serializes the `updates` hash map into a string.
fn legacy_serialize_updates(
    net: &str,
    updates: &BatchedAggegratesToSend,
    feeds_config: HashMap<u32, FeedStrideAndDecimals>,
) -> Vec<u8> {
    let mut result: String = Default::default();

    let selector = "0x1a2d80ac";
    result.push_str(selector);

    info!("Preparing a legacy batch of feeds to network `{net}`");

    let mut num_reported_feeds = 0;
    for update in &updates.updates {
        let feed_id = update.feed_id;
        let feed_config = feeds_config.get(&feed_id);

        let digits_in_fraction = match &feed_config {
            Some(f) => f.decimals,
            None => {
                error!("Propagating result for unregistered feed! Support left for legacy one shot feeds of 32 bytes size. Decimal default to 18");
                18
            }
        };

        let (key, val) = match update.encode(
            digits_in_fraction as usize,
            update.end_slot_timestamp as u64,
        ) {
            Ok((k, v)) => (k, v),
            Err(e) => {
                error!("Error converting value for feed id {} to bytes {}. Skipping inclusion in block!", update.feed_id, e);
                continue;
            }
        };

        num_reported_feeds += 1;
        result += to_hex_string(key, None).as_str();
        result += to_hex_string(val, Some(32)).as_str(); // TODO: Get size to pad to based on strinde in feed_config. Also check!
    }
    info!("Sending a batch of {num_reported_feeds} feeds to network `{net}`");

    hex::decode(result).expect("result is a valid hex string")
}

/// If `allowed_feed_ids` is specified only the feeds from `updates` that are allowed
/// will be added to the result. Otherwise, all feeds in `updates` will be added.
pub fn filter_allowed_feeds(
    net: &str,
    updates: &mut BatchedAggegratesToSend,
    allow_feeds: &Option<Vec<u32>>,
) {
    if let Some(allowed_feed_ids) = allow_feeds {
        let mut res: Vec<VotedFeedUpdate> = vec![];
        for u in &updates.updates {
            let feed_id = u.feed_id;
            if allowed_feed_ids.is_empty() || allowed_feed_ids.contains(&feed_id) {
                res.push(u.clone());
            } else {
                debug!("Skipping feed id {feed_id} for special network `{net}`");
            }
        }
        updates.updates = mem::take(&mut res);
    }
}

// Will reduce the updates to only the relevant for the network
pub async fn get_serialized_updates_for_network(
    net: &str,
    provider_mutex: &Arc<Mutex<RpcProvider>>,
    updates: &mut BatchedAggegratesToSend,
    provider_settings: &blocksense_config::Provider,
    feeds_config: Arc<RwLock<HashMap<u32, FeedConfig>>>,
    feeds_rounds: &mut HashMap<u32, u64>,
) -> Result<Vec<u8>> {
    debug!("Acquiring a read lock on provider config for `{net}`");
    let provider = provider_mutex.lock().await;
    debug!("Acquired a read lock on provider config for `{net}`");
    filter_allowed_feeds(net, updates, &provider_settings.allow_feeds);
    provider.peg_stable_coins_to_value(updates);
    provider.apply_publish_criteria(updates);

    // Don’t post to Smart Contract if we have 0 updates
    if updates.updates.is_empty() {
        return Ok(Vec::new());
    }

    let contract_version = provider
        .get_contract(PRICE_FEED_CONTRACT_NAME)
        .ok_or(eyre!("{PRICE_FEED_CONTRACT_NAME} contract is not set!"))?
        .contract_version;
    drop(provider);
    debug!("Released a read lock on provider config for `{net}`");

    let mut strides_and_decimals = HashMap::new();
    let mut relevant_feed_ids = HashSet::new();

    for update in updates.updates.iter() {
        relevant_feed_ids.extend(get_neighbour_feed_ids(update.feed_id));
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

    let serialized_updates = match contract_version {
        1 => {
            let bytes = legacy_serialize_updates(net, updates, strides_and_decimals);
            debug!(
                "legacy_serialize_updates result for network {} and block height {} = {}",
                net,
                updates.block_height,
                hex::encode(&bytes)
            );
            bytes
        }
        2 => {
            let provider = provider_mutex.lock().await;
            match adfs_serialize_updates(
                net,
                updates,
                Some(&provider.round_counters),
                strides_and_decimals,
                feeds_rounds,
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
        }
        _ => bail!("Unsupported contract version set for network {net}!"),
    };

    Ok(serialized_updates)
}

pub struct BatchOfUpdatesToProcess {
    pub net: String,
    pub provider: Arc<Mutex<RpcProvider>>,
    pub provider_settings: blocksense_config::Provider,
    pub updates: BatchedAggegratesToSend,
    pub feed_type: Repeatability,
    pub feeds_config: Arc<RwLock<HashMap<u32, FeedConfig>>>,
    pub transaction_retry_timeout_secs: u64,
    pub transaction_retries_count_limit: u64,
    pub retry_fee_increment_fraction: f64,
}

pub async fn create_and_collect_relayers_futures(
    collected_futures: &FuturesUnordered<JoinHandle<Result<(), Error>>>,
    feeds_metrics: Arc<RwLock<FeedsMetrics>>,
    provider_status: Arc<RwLock<HashMap<String, ProviderStatus>>>,
    relayers_recv_channels: HashMap<String, UnboundedReceiver<BatchOfUpdatesToProcess>>,
) {
    for (net, chan) in relayers_recv_channels.into_iter() {
        let feed_metrics_clone = feeds_metrics.clone();
        let provider_status_clone = provider_status.clone();
        let relayer_name = format!("relayer_for_network {net}");
        collected_futures.push(
            tokio::task::Builder::new()
                .name(relayer_name.clone().as_str())
                .spawn(async move {
                    loop_processing_batch_of_updates(
                        net,
                        relayer_name,
                        feed_metrics_clone,
                        provider_status_clone,
                        chan,
                    )
                    .await;
                    Ok(())
                })
                .expect("Failed to spawn metrics collector loop!"),
        );
    }
}

pub async fn loop_processing_batch_of_updates(
    net: String,
    relayer_name: String,
    feeds_metrics: Arc<RwLock<FeedsMetrics>>,
    provider_status: Arc<RwLock<HashMap<String, ProviderStatus>>>,
    mut chan: UnboundedReceiver<BatchOfUpdatesToProcess>,
) {
    tracing::info!("Starting {relayer_name} loop...");

    //TODO: Create a termination reason pattern in the future. At this point networks are not added/removed dynamically in the sequencer,
    // therefore the loop in iterating over the lifetime of the sequencer.
    loop {
        let cmd_opt = chan.recv().await;
        match cmd_opt {
            Some(cmd) => {
                let block_height = cmd.updates.block_height;
                let provider = cmd.provider.clone();
                let result = eth_batch_send_to_contract(
                    cmd.net,
                    cmd.provider,
                    cmd.provider_settings,
                    cmd.updates,
                    cmd.feed_type,
                    cmd.feeds_config,
                    cmd.transaction_retry_timeout_secs,
                    cmd.transaction_retries_count_limit,
                    cmd.retry_fee_increment_fraction,
                )
                .await;

                let provider_metrics = provider.lock().await.provider_metrics.clone();
                dec_metric!(provider_metrics, net, num_transactions_in_queue);

                match result {
                    Ok((status, updated_feeds)) => {
                        let mut result_str = String::new();
                        result_str += &format!("result from network {net} and block height {block_height}: Ok -> status: {status}");
                        if status == "true" {
                            result_str += &format!(", updated_feeds: {updated_feeds:?}");
                            increment_feeds_round_metrics(
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
                            decrement_feeds_round_indexes(
                                &updated_feeds,
                                net.as_str(),
                                &mut provider,
                            )
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

#[allow(clippy::too_many_arguments)]
pub async fn eth_batch_send_to_contract(
    net: String,
    provider: Arc<Mutex<RpcProvider>>,
    provider_settings: blocksense_config::Provider,
    mut updates: BatchedAggegratesToSend,
    feed_type: Repeatability,
    feeds_config: Arc<RwLock<HashMap<u32, FeedConfig>>>,
    transaction_retry_timeout_secs: u64,
    transaction_retries_count_limit: u64,
    retry_fee_increment_fraction: f64,
) -> Result<(String, Vec<u32>)> {
    let mut feeds_rounds = HashMap::new();
    let serialized_updates = get_serialized_updates_for_network(
        net.as_str(),
        &provider,
        &mut updates,
        &provider_settings,
        feeds_config,
        &mut feeds_rounds,
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
    let mut provider = provider.lock().await;
    debug!("Acquired a read/write lock on provider state for network `{net}` block height {block_height}");

    let feeds_to_update_ids: Vec<u32> = updates
        .updates
        .iter()
        .map(|update| update.feed_id)
        .collect();

    increment_feeds_round_indexes(&feeds_to_update_ids, net.as_str(), &mut provider).await;

    let signer = &provider.signer;
    let contract_name = if feed_type == Periodic {
        PRICE_FEED_CONTRACT_NAME
    } else {
        EVENT_FEED_CONTRACT_NAME
    };
    let contract_address = provider.get_contract_address(contract_name)?;
    info!(
        "sending data to address `{}` in network `{}` block height {block_height}",
        contract_address, net
    );

    let provider_metrics = &provider.provider_metrics;
    let rpc_handle = &provider.provider;

    let input = Bytes::from(serialized_updates);

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

    loop {
        debug!("loop begin; transaction_retries_count={transaction_retries_count} in network `{net}` block height {block_height} with transaction_retries_count_limit = {transaction_retries_count_limit} and transaction_retry_timeout_secs = {transaction_retry_timeout_secs}");

        if transaction_retries_count > transaction_retries_count_limit {
            return Ok(("timeout".to_string(), feeds_to_update_ids));
        }

        match get_nonce(
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
                    //TODO: Check the tx hashes of all posted/retried txs for block inclusion
                    return Ok(("true".to_string(), feeds_to_update_ids));
                }
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

        let tx;
        if transaction_retries_count == 0 {
            tx = TransactionRequest::default()
                .to(contract_address)
                .with_nonce(nonce)
                .with_from(sender_address)
                .with_chain_id(chain_id)
                .input(Some(input.clone()).into());
            debug!("Sending initial tx: {tx:?} in network `{net}` block height {block_height}");
        } else {
            debug!(
                "Retrying to send updates in network `{net}` block height {block_height} for {transaction_retries_count}-th time"
            );

            let (max_fee_per_gas, priority_fee) = match get_tx_retry_params(
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

            tx = TransactionRequest::default()
                .to(contract_address)
                .with_nonce(nonce)
                .with_from(sender_address)
                .with_max_fee_per_gas(max_fee_per_gas)
                .with_max_priority_fee_per_gas(priority_fee)
                .with_chain_id(chain_id)
                .input(Some(input.clone()).into());
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
                    debug!("Successfully got receipt from RPC in network `{net}` block height {block_height} and address {sender_address} tx_hash = {tx_hash}");
                    inc_metric!(provider_metrics, net, success_get_receipt);
                    v
                }
                Err(err) => {
                    debug!("Timed out while trying to post tx to RPC and get tx_hash in network `{net}` block height {block_height} and address {sender_address} due to {err} and will try again");

                    let receipt = match actix_web::rt::time::timeout(
                        Duration::from_secs(transaction_retry_timeout_secs),
                        rpc_handle.get_transaction_receipt(tx_hash),
                    )
                    .await
                    {
                        Ok(v) => match v {
                            Ok(v) => match v {
                                Some(v) => {
                                    debug!("Successfully got tx_receipt in network `{net}` block height {block_height}");
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
                    };
                    receipt
                }
            };

            inc_metric!(provider_metrics, net, total_tx_sent);
            info!("Successfully posted tx to RPC and got tx_hash in network `{net}` block height {block_height} and address {sender_address} tx_hash = {tx_hash}");

            tx_receipt
        };

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

    provider.update_history(&updates.updates);
    drop(provider);
    debug!("Released a read/write lock on provider state in network `{net}` block height {block_height}");

    Ok((receipt.status().to_string(), feeds_to_update_ids))
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
    inc_metric!(provider_metrics, net, total_tx_sent);
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
    updates: &BatchedAggegratesToSend,
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
    updates: &BatchedAggegratesToSend,
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
    provider: &Arc<Mutex<RpcProvider>>,
    is_enabled_value: bool,
) {
    debug!("Acquiring a read lock on provider for network {net}");
    let p = provider.lock().await;
    debug!("Acquired a read lock on provider for network {net}");
    let provider_metrics = p.provider_metrics.clone();
    set_metric!(provider_metrics, net, is_enabled, is_enabled_value);
    debug!("Released a read lock on provider for network {net}");
}

pub async fn get_tx_retry_params(
    net: &str,
    rpc_handle: &ProviderType,
    provider_metrics: &Arc<RwLock<ProviderMetrics>>,
    sender_address: &Address,
    transaction_retry_timeout_secs: u64,
    transaction_retries_count: u64,
    retry_fee_increment_fraction: f64,
) -> Result<(u128, u128)> {
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
                debug!("Failed to get priority_fee for network {net} due to {err}");
                return Err(err.into());
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

    Ok((max_fee_per_gas, priority_fee))
}

pub async fn eth_batch_send_to_all_contracts(
    sequencer_state: Data<SequencerState>,
    updates: BatchedAggegratesToSend,
    feed_type: Repeatability,
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

        // No lock, we propagete the shared objects to the created futures
        let feeds_config = sequencer_state.active_feeds.clone();

        for (net, provider) in providers.iter() {
            let (
                transaction_retries_count_limit,
                transaction_retry_timeout_secs,
                retry_fee_increment_fraction,
            ) = {
                debug!("Acquiring a read lock on provider for network {net}");
                let p = provider.lock().await;
                debug!("Acquired and releasing a read lock on provider for network {net}");
                (
                    p.transaction_retries_count_limit as u64,
                    p.transaction_retry_timeout_secs as u64,
                    p.retry_fee_increment_fraction,
                )
            };

            let net = net.clone();

            if let Some(provider_settings) = providers_config.get(&net) {
                if provider_settings.safe_address.is_some() {
                    info!(
                        "Network `{net}` is configured for two phase consensus in sequencer; skipping direct update"
                    );
                    continue;
                }
                let is_enabled_value = provider_settings.is_enabled;

                log_provider_enabled(net.as_str(), provider, is_enabled_value).await;

                if !is_enabled_value {
                    warn!("Network `{net}` is not enabled; skipping it during reporting");
                    continue;
                } else {
                    info!("Network `{net}` is enabled; reporting...");
                }

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
                    feed_type,
                    feeds_config,
                    transaction_retry_timeout_secs,
                    transaction_retries_count_limit,
                    retry_fee_increment_fraction,
                };

                {
                    let provider_metrics = provider.lock().await.provider_metrics.clone();
                    let relayers = sequencer_state.relayers_send_channels.read().await;
                    let relayer_opt = relayers.get(net.as_str());
                    if let Some(relayer) = relayer_opt {
                        match relayer.send(batch_of_updates_to_process) {
                            Ok(_) => {
                                debug!("Sent updates to relayer for network {net} and block height {block_height}");
                                inc_metric!(provider_metrics, net, num_transactions_in_queue);
                            }
                            Err(e) => {
                                error!("Error while sending updates to relayer for network {net} and block height {block_height}: {e}")
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
    error!("{}", errors_vec.join("; "));
    Ok(())
}

async fn log_round_counters(
    prefix: &str,
    updated_feeds: &Vec<u32>,
    round_counters: &mut RoundCounters,
    net: &str,
) {
    let mut debug_string =
        format!("{prefix} for net = {net} and updated_feeds = {updated_feeds:?} ");
    for feed in updated_feeds {
        let round_index = round_counters.get(feed).unwrap_or(&0_u64);
        debug_string.push_str(format!("{feed} = {round_index}; ").as_str());
    }
    debug!(debug_string);
}

pub async fn increment_feeds_round_indexes(
    updated_feeds: &Vec<u32>,
    net: &str,
    provider: &mut RpcProvider,
) {
    log_round_counters(
        "increment_feeds_round_indexes before update",
        updated_feeds,
        &mut provider.round_counters,
        net,
    )
    .await;

    for feed in updated_feeds {
        let round_counter = provider.round_counters.entry(*feed).or_insert(0);
        *round_counter += 1;
    }

    log_round_counters(
        "increment_feeds_round_indexes after update",
        updated_feeds,
        &mut provider.round_counters,
        net,
    )
    .await;
}
// Since we update the round counters when we post the tx and before we
// receive its receipt if the tx fails we need to decrease the round indexes.
pub async fn decrement_feeds_round_indexes(
    updated_feeds: &Vec<u32>,
    net: &str,
    provider: &mut RpcProvider,
) {
    log_round_counters(
        "decrement_feeds_round_indexes before update",
        updated_feeds,
        &mut provider.round_counters,
        net,
    )
    .await;

    for feed in updated_feeds {
        let round_counter = provider.round_counters.entry(*feed).or_insert(0);
        if *round_counter > 0 {
            *round_counter -= 1;
        }
    }

    log_round_counters(
        "decrement_feeds_round_indexes after update",
        updated_feeds,
        &mut provider.round_counters,
        net,
    )
    .await;
}

async fn increment_feeds_round_metrics(
    updated_feeds: &Vec<u32>,
    feeds_metrics: Option<Arc<RwLock<FeedsMetrics>>>,
    net: &str,
) {
    if let Some(ref fm) = feeds_metrics {
        for feed in updated_feeds {
            // update the round counters' metrics accordingly
            inc_vec_metric!(fm, updates_to_networks, feed, net);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::providers::provider::{init_shared_rpc_providers, MULTICALL_CONTRACT_NAME};
    use crate::sequencer_state::create_sequencer_state_from_sequencer_config;
    use alloy::rpc::types::eth::TransactionInput;
    use alloy::{
        hex::FromHex,
        primitives::{Address, TxKind},
    };
    use alloy::{node_bindings::Anvil, providers::Provider};
    use blocksense_config::{
        get_test_config_with_multiple_providers, get_test_config_with_single_provider,
        test_feed_config,
    };
    use blocksense_config::{AllFeedsConfig, PublishCriteria};
    use blocksense_data_feeds::feeds_processing::VotedFeedUpdate;
    use blocksense_feed_registry::registry::HistoryEntry;
    use blocksense_feed_registry::types::Repeatability::Oneshot;
    use blocksense_utils::test_env::get_test_private_key_path;

    use regex::Regex;
    use ringbuf::traits::Consumer;
    use std::io::Error;
    use std::str::FromStr;
    use std::time::UNIX_EPOCH;
    use tokio::task::JoinHandle;

    fn extract_address(message: &str) -> Option<String> {
        let re = Regex::new(r"0x[a-fA-F0-9]{40}").expect("Invalid regex");
        if let Some(mat) = re.find(message) {
            return Some(mat.as_str().to_string());
        }
        None
    }

    fn test_feeds_config() -> HashMap<u32, FeedStrideAndDecimals> {
        let mut feeds_config = HashMap::new();
        feeds_config.insert(
            0,
            FeedStrideAndDecimals {
                stride: 0,
                decimals: 18,
            },
        );
        feeds_config
    }

    #[tokio::test]
    async fn test_deploy_contract_returns_valid_address() {
        // setup
        let anvil = Anvil::new().try_spawn().unwrap();
        let network = "ETH131";
        let key_path = get_test_private_key_path();

        let cfg = get_test_config_with_single_provider(
            network,
            key_path.as_path(),
            anvil.endpoint().as_str(),
        );
        let feeds_config = AllFeedsConfig { feeds: vec![] };
        // give some time for cleanup env variables
        let providers = init_shared_rpc_providers(
            &cfg,
            Some("test_deploy_contract_returns_valid_address_"),
            &feeds_config,
        )
        .await;

        // run
        let result =
            deploy_contract(&String::from(network), &providers, PRICE_FEED_CONTRACT_NAME).await;
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

    #[actix_web::test]
    async fn test_eth_batch_send_to_oneshot_contract() {
        /////////////////////////////////////////////////////////////////////
        // BIG STEP ONE - Setup Anvil and deploy SportsDataFeedStoreV2 to it
        /////////////////////////////////////////////////////////////////////

        // setup
        let anvil = Anvil::new().try_spawn().unwrap();
        let key_path = get_test_private_key_path();
        let network = "ETH333";

        let cfg = get_test_config_with_single_provider(
            network,
            key_path.as_path(),
            anvil.endpoint().as_str(),
        );
        let feed_1_config = test_feed_config(1, 0);
        let feeds_config = AllFeedsConfig {
            feeds: vec![feed_1_config],
        };
        let providers = init_shared_rpc_providers(
            &cfg,
            Some("test_eth_batch_send_to_oneshot_contract_"),
            &feeds_config,
        )
        .await;

        // run
        let result =
            deploy_contract(&String::from(network), &providers, EVENT_FEED_CONTRACT_NAME).await;
        // assert
        // validate contract was deployed at expected address
        if let Ok(msg) = result {
            let extracted_address = extract_address(&msg);
            assert!(
                extracted_address.is_some(),
                "Did not return valid eth address"
            );
        } else {
            panic!("contract deployment failed")
        }

        /////////////////////////////////////////////////////////////////////
        // BIG STEP TWO - Prepare sample updates and write to the contract
        /////////////////////////////////////////////////////////////////////

        let net = "ETH333".to_string();

        let providers = providers.read().await;

        let provider = providers.get("ETH333").unwrap();

        // Updates for Oneshot
        /*
        struct FootballData {
             uint32 homeScore;
             uint32 awayScore;
             uint32 homeShots;
             uint32 awayShots;
             uint32 homePenalties;
             uint32 awayPenalties;
             uint32 homeSaves;
             uint32 awaySaves;
             uint32 homeFirstHalfTimeScore;
             uint32 awayFirstHalfTimeScore;
        }
        */
        let result_key = String::from("00000003"); // 4 bytes of zeroes in hex
        let number_of_slots: String = String::from("0002"); // number 2 in two-bytes hex
        let slot1 =
            String::from("0000000100000002000000030000000400000005000000060000000700000008");
        let slot2 =
            String::from("0000000900000001000000000000000000000000000000000000000000000000");
        let payload: String = format!("{slot1}{slot2}");
        let description =
            String::from("0000000000000000000000000000000000000000000000000000000000000000");
        let result_value = format!("{number_of_slots}{payload}{description}");

        let end_slot_timestamp = 0_u128;
        let voted_update = VotedFeedUpdate::new_decode(
            &result_key,
            &result_value,
            end_slot_timestamp,
            blocksense_feed_registry::types::FeedType::Numerical(0.0f64),
            18,
        )
        .unwrap();
        let updates_oneshot = BatchedAggegratesToSend {
            block_height: 0,
            updates: vec![voted_update],
        };
        let provider_settings = cfg
            .providers
            .get(&net)
            .unwrap_or_else(|| panic!("Config for network {net} not found!"))
            .clone();
        let feeds_config = Arc::new(RwLock::new(HashMap::<u32, FeedConfig>::new()));

        let result = eth_batch_send_to_contract(
            net.clone(),
            provider.clone(),
            provider_settings,
            updates_oneshot,
            Oneshot,
            feeds_config,
            50,
            10,
            0.1,
        )
        .await;
        assert!(result.is_ok());
        // getter calldata will be:
        // 0x800000030000000000000000000000000000000000000000000000000000000000000002
        let calldata = String::from(
            "0x800000030000000000000000000000000000000000000000000000000000000000000002",
        );
        let calldata_bytes = Bytes::from_hex(calldata).expect("Invalid calldata");
        let address_to_send = provider
            .lock()
            .await
            .get_contract_address(EVENT_FEED_CONTRACT_NAME)
            .unwrap();
        let result = provider
            .lock()
            .await
            .provider
            .call(TransactionRequest {
                to: Some(TxKind::Call(address_to_send)),
                input: TransactionInput {
                    input: Some(calldata_bytes.clone()),
                    data: Some(calldata_bytes.clone()),
                },
                ..Default::default()
            })
            .await;
        println!("@@0b result: {result:?}");
        assert!(result.is_ok(), "Call to getFeedById failed");
        let output = result.unwrap();
        assert_eq!(output.len(), 64, "Invalid output length");
    }

    #[actix_web::test]
    async fn test_eth_batch_send_to_all_oneshot_contracts() {
        let metrics_prefix = "test_eth_batch_send_to_all_oneshot_contracts";

        /////////////////////////////////////////////////////////////////////
        // BIG STEP ONE - Setup Anvil and deploy SportsDataFeedStoreV2 to it
        /////////////////////////////////////////////////////////////////////

        // setup
        let key_path = get_test_private_key_path();

        let anvil_network1 = Anvil::new().try_spawn().unwrap();
        let network1 = "ETH374";
        let anvil_network2 = Anvil::new().try_spawn().unwrap();
        let network2 = "ETH375";
        let anvil_network3 = Anvil::new().try_spawn().unwrap();
        let network3 = "ETH_test_eth_batch_send_to_all_oneshot_contracts";

        let sequencer_config = get_test_config_with_multiple_providers(vec![
            (
                network1,
                key_path.as_path(),
                anvil_network1.endpoint().as_str(),
            ),
            (
                network2,
                key_path.as_path(),
                anvil_network2.endpoint().as_str(),
            ),
            (
                network3,
                key_path.as_path(),
                anvil_network3.endpoint().as_str(),
            ),
        ]);
        let feeds_config: AllFeedsConfig = AllFeedsConfig {
            feeds: vec![test_feed_config(1, 0)],
        };
        let (sequencer_state, _, _, _, _, relayers_recv_channels) =
            create_sequencer_state_from_sequencer_config(
                sequencer_config,
                metrics_prefix,
                feeds_config,
            )
            .await;

        let collected_futures: FuturesUnordered<JoinHandle<Result<(), Error>>> =
            FuturesUnordered::new();

        let feeds_metrics = sequencer_state.feeds_metrics.clone();
        let provider_status = sequencer_state.provider_status.clone();

        create_and_collect_relayers_futures(
            &collected_futures,
            feeds_metrics,
            provider_status,
            relayers_recv_channels,
        )
        .await;

        let msg = sequencer_state
            .deploy_contract(network1, EVENT_FEED_CONTRACT_NAME)
            .await
            .expect("contract deployment failed");

        // assert
        // validate contract was deployed at expected address
        let extracted_address = extract_address(&msg);
        assert!(
            extracted_address.is_some(),
            "Did not return valid eth address"
        );
        let msg2 = sequencer_state
            .deploy_contract(network2, EVENT_FEED_CONTRACT_NAME)
            .await
            .expect("contract deployment failed");

        // validate contract was deployed at expected address
        let extracted_address = extract_address(&msg2);
        assert!(
            extracted_address.is_some(),
            "Did not return valid eth address"
        );

        /////////////////////////////////////////////////////////////////////
        // BIG STEP TWO - Prepare sample updates and write to the contract
        /////////////////////////////////////////////////////////////////////

        // Updates for Oneshot
        let slot1 =
            String::from("0404040404040404040404040404040404040404040404040404040404040404");
        let slot2 =
            String::from("0505050505050505050505050505050505050505050505050505050505050505");
        let value1 = format!("{:04x}{}{}", 0x0002, slot1, slot2);
        let end_of_timeslot = 0_u128;
        let updates_oneshot = BatchedAggegratesToSend {
            block_height: 0,
            updates: vec![VotedFeedUpdate::new_decode(
                "00000003",
                &value1,
                end_of_timeslot,
                FeedType::Text("".to_string()),
                18,
            )
            .unwrap()],
        };

        let result =
            eth_batch_send_to_all_contracts(sequencer_state, updates_oneshot, Oneshot).await;
        // TODO: This is actually not a good assertion since the eth_batch_send_to_all_contracts
        // will always return ok even if some or all of the sends we unsuccessful. Will be fixed in
        // followups
        assert!(result.is_ok());
    }

    #[actix_web::test]
    async fn test_eth_batch_send_to_multidata_contracts_and_read_value() {
        let metrics_prefix = "test_eth_batch_send_to_multidata_contracts_and_read_value";

        /////////////////////////////////////////////////////////////////////
        // BIG STEP ONE - Setup Anvil and deploy SportsDataFeedStoreV2 to it
        /////////////////////////////////////////////////////////////////////

        // setup
        let key_path = get_test_private_key_path();
        let anvil_network1 = Anvil::new().try_spawn().unwrap();
        let network1 = "ETH17787";
        let sequencer_config = get_test_config_with_multiple_providers(vec![(
            network1,
            key_path.as_path(),
            anvil_network1.endpoint().as_str(),
        )]);

        let mut feed = test_feed_config(1, 0);

        feed.schedule.interval_ms = 1000; // 1 secound
        let feeds_config: AllFeedsConfig = AllFeedsConfig {
            feeds: vec![feed.clone()],
        };
        let (sequencer_state, _, _, _, _, relayers_recv_channels) =
            create_sequencer_state_from_sequencer_config(
                sequencer_config,
                metrics_prefix,
                feeds_config,
            )
            .await;

        let collected_futures: FuturesUnordered<JoinHandle<Result<(), Error>>> =
            FuturesUnordered::new();

        let feeds_metrics: Arc<RwLock<FeedsMetrics>> = sequencer_state.feeds_metrics.clone();
        let provider_status: Arc<RwLock<HashMap<String, ProviderStatus>>> =
            sequencer_state.provider_status.clone();

        create_and_collect_relayers_futures(
            &collected_futures,
            feeds_metrics,
            provider_status,
            relayers_recv_channels,
        )
        .await;

        // run
        let msg = sequencer_state
            .deploy_contract(network1, PRICE_FEED_CONTRACT_NAME)
            .await
            .expect("Data feed publishing contract deployment failed!");
        // assert
        // validate contract was deployed at expected address
        let extracted_address = extract_address(&msg).expect("Did not return valid eth address");
        let contract_address =
            Address::parse_checksummed(&extracted_address, None).expect("valid checksum");

        {
            let providers = sequencer_state.providers.read().await;
            let p = providers.get(network1).unwrap().lock().await;
            let nonce = p.provider.get_transaction_count(contract_address).await;
            assert!(nonce.is_ok());
            assert_eq!(nonce.unwrap(), 1);
        }

        /////////////////////////////////////////////////////////////////////
        // BIG STEP TWO - Prepare sample updates and write to the contract
        /////////////////////////////////////////////////////////////////////

        {
            let providers = sequencer_state.providers.read().await;
            let mut p = providers.get(network1).unwrap().lock().await;
            p.history.register_feed(feed.id, 100);
        }
        let interval_ms = feed.schedule.interval_ms as u128;
        {
            // Some arbitrary point in time in the past, nothing special about this value
            let first_report_start_time = UNIX_EPOCH + Duration::from_secs(1524885322);
            let end_slot_timestamp = first_report_start_time.elapsed().unwrap().as_millis();
            let v1 = VotedFeedUpdate {
                feed_id: feed.id,
                value: FeedType::Numerical(103082.01f64),
                end_slot_timestamp: end_slot_timestamp + interval_ms,
            };
            let v2 = VotedFeedUpdate {
                feed_id: feed.id,
                value: FeedType::Numerical(103012.21f64),
                end_slot_timestamp: end_slot_timestamp + interval_ms * 2,
            };

            let v3 = VotedFeedUpdate {
                feed_id: feed.id,
                value: FeedType::Numerical(104011.78f64),
                end_slot_timestamp: end_slot_timestamp + interval_ms * 3,
            };

            let updates1 = BatchedAggegratesToSend {
                block_height: 0,
                updates: vec![v1],
            };
            let updates2 = BatchedAggegratesToSend {
                block_height: 1,
                updates: vec![v2],
            };
            let updates3 = BatchedAggegratesToSend {
                block_height: 2,
                updates: vec![v3],
            };

            let p1 =
                eth_batch_send_to_all_contracts(sequencer_state.clone(), updates1, Periodic).await;
            assert!(p1.is_ok());

            let p2 =
                eth_batch_send_to_all_contracts(sequencer_state.clone(), updates2, Periodic).await;
            assert!(p2.is_ok());

            let p3 =
                eth_batch_send_to_all_contracts(sequencer_state.clone(), updates3, Periodic).await;
            assert!(p3.is_ok());
        }

        // wait for the updates to be published
        let time_to_await: Duration = Duration::from_millis((interval_ms * 4) as u64);
        let mut interval = interval(time_to_await);
        interval.tick().await;
        // The first tick completes immediately.
        interval.tick().await;

        /////////////////////////////////////////////////////////////////////
        // BIG STEP THREE - Read data from contract and verify that it's correct
        /////////////////////////////////////////////////////////////////////

        let msg = sequencer_state
            .deploy_contract(network1, MULTICALL_CONTRACT_NAME)
            .await
            .expect("Mutlicall contract deployment failed!");
        let _extracted_address = extract_address(&msg).expect("Did not return valid eth address");
        {
            let p = sequencer_state.get_provider(network1).await.unwrap();
            let p_lock = p.lock().await;

            let latest = p_lock
                .get_latest_values(&[feed.id])
                .await
                .expect("Can't get latest values from contract");
            assert_eq!(latest.len(), 1);
            let latest = latest[0].clone().expect("no error in feed");
            assert_eq!(latest.feed_id, 1_u32);
            assert_eq!(latest.num_updates, 3_u128);
            assert_eq!(latest.value, FeedType::Numerical(104011.78f64));

            let history = p_lock
                .get_historical_values_for_feed(feed.id, &[0_u128, 1_u128, 2_u128, 3_u128, 4_u128])
                .await
                .expect("Error when reading historical values from contract!");

            assert_eq!(history.len(), 5);

            let feed_ids: Vec<u32> = history
                .iter()
                .map(|x| match x {
                    Ok(x) => x.feed_id,
                    Err(x) => x.feed_id,
                })
                .collect();

            let errors: Vec<Option<&str>> = history
                .iter()
                .map(|x| match x {
                    Ok(_) => None,
                    Err(x) => Some(x.error.as_str()),
                })
                .collect();

            let values: Vec<Option<FeedType>> = history
                .iter()
                .map(|x| match x {
                    Ok(x) => Some(x.value.clone()),
                    Err(_) => None,
                })
                .collect();

            let vec_num_updates: Vec<u128> = history
                .iter()
                .map(|x| match x {
                    Ok(x) => x.num_updates,
                    Err(x) => x.num_updates,
                })
                .collect();

            let vec_published: Vec<Option<u128>> = history
                .iter()
                .map(|x| match x {
                    Ok(x) => Some(x.published),
                    Err(_) => None,
                })
                .collect();

            assert_eq!(feed_ids[0], 1_u32);
            assert_eq!(feed_ids[1], 1_u32);
            assert_eq!(feed_ids[2], 1_u32);
            assert_eq!(feed_ids[3], 1_u32);
            assert_eq!(feed_ids[4], 1_u32);

            assert_eq!(errors[0], Some("Timestamp is zero"));
            assert_eq!(values[1], Some(FeedType::Numerical(103082.01f64)));
            assert_eq!(values[2], Some(FeedType::Numerical(103012.21f64)));
            assert_eq!(values[3], Some(FeedType::Numerical(104011.78f64)));
            assert_eq!(errors[4], Some("Timestamp is zero"));

            assert_eq!(vec_num_updates[0], 0_u128);
            assert_eq!(vec_num_updates[1], 1_u128);
            assert_eq!(vec_num_updates[2], 2_u128);
            assert_eq!(vec_num_updates[3], 3_u128);
            assert_eq!(vec_num_updates[4], 4_u128);

            assert_eq!(vec_published[0], None);
            assert_ne!(vec_published[1], Some(0_u128));
            assert_ne!(vec_published[2], Some(0_u128));
            assert_ne!(vec_published[3], Some(0_u128));
            assert_eq!(vec_published[4], None);
        }

        {
            let provider = sequencer_state
                .get_provider(network1)
                .await
                .expect("Provider should be available");
            let mut p_lock = provider.lock().await;
            let num_cleared = p_lock.history.clear(feed.id);
            assert_eq!(num_cleared, 3);
            let limit = 2_u32;
            let num_loaded = p_lock
                .load_history_from_chain(feed.id, limit)
                .await
                .unwrap();
            assert_eq!(num_loaded, 2);

            let v = p_lock
                .history
                .get(feed.id)
                .expect("Give me history")
                .iter()
                .cloned()
                .collect::<Vec<HistoryEntry>>();
            assert_eq!(v.len(), 2);
            assert_eq!(v[0].update_number, 2_u128);
            assert_eq!(v[0].value, FeedType::Numerical(103012.21f64));
            assert_eq!(v[1].update_number, 3_u128);
            assert_eq!(v[1].value, FeedType::Numerical(104011.78f64));
        }

        {
            let provider = sequencer_state
                .get_provider(network1)
                .await
                .expect("Provider should be available");
            let mut p_lock = provider.lock().await;

            let limit = 200_u32;

            // Make sure the values are not loaded more then once in history
            let num_loaded = p_lock
                .load_history_from_chain(feed.id, limit)
                .await
                .unwrap();
            assert_eq!(num_loaded, 0);

            let v = p_lock
                .history
                .get(feed.id)
                .expect("Give me history")
                .iter()
                .cloned()
                .collect::<Vec<HistoryEntry>>();
            assert_eq!(v.len(), 2);
            assert_eq!(v[0].update_number, 2_u128);
            assert_eq!(v[0].value, FeedType::Numerical(103012.21f64));
            assert_eq!(v[1].update_number, 3_u128);
            assert_eq!(v[1].value, FeedType::Numerical(104011.78f64));
            // The date and time  of publishing is determined by the smart contarct, so we don't have control of this value
            info!(
                "Historical update {} publish date {:?}",
                v[0].update_number,
                v[0].get_date_time_published()
            );
            info!(
                "Historical update {} publish date {:?}",
                v[1].update_number,
                v[1].get_date_time_published()
            );
        }
    }

    #[tokio::test]
    async fn compute_keys_vals_ignores_networks_not_on_the_list() {
        let selector = "1a2d80ac";
        let network = "dont_filter_me";
        let mut updates = BatchedAggegratesToSend {
            block_height: 0,
            updates: get_updates_test_data(),
        };
        filter_allowed_feeds(network, &mut updates, &None);
        let serialized_updates = legacy_serialize_updates(network, &updates, test_feeds_config());

        let a = "0000001f6869000000000000000000000000000000000000000000000000000000000000";
        let b = "00000fff6279650000000000000000000000000000000000000000000000000000000000";
        let ab = hex::decode(format!("{selector}{a}{b}")).unwrap();
        let ba = hex::decode(format!("{selector}{b}{a}")).unwrap();
        // It is undeterministic what the order will be, so checking both possibilities.
        assert!(ab == serialized_updates || ba == serialized_updates);
    }
    use blocksense_feed_registry::types::FeedType;

    fn get_updates_test_data() -> Vec<VotedFeedUpdate> {
        //let updates = HashMap::from([("001f", "hi"), ("0fff", "bye")]);
        let end_slot_timestamp = 0_u128;
        let v1 = VotedFeedUpdate {
            feed_id: 0x1F_u32,
            value: FeedType::Text("hi".to_string()),
            end_slot_timestamp,
        };
        let v2 = VotedFeedUpdate {
            feed_id: 0x0FFF,
            value: FeedType::Text("bye".to_string()),
            end_slot_timestamp,
        };
        let updates: Vec<VotedFeedUpdate> = vec![v1, v2];
        updates
    }

    #[tokio::test]
    async fn compute_keys_vals_filters_updates_for_networks_on_the_list() {
        let selector = "0x1a2d80ac";
        // Citrea
        let network = "citrea-testnet";

        let mut updates = BatchedAggegratesToSend {
            block_height: 0,
            updates: get_updates_test_data(),
        };

        filter_allowed_feeds(
            network,
            &mut updates,
            &Some(vec![
                31,  // BTC/USD
                47,  // ETH/USD
                65,  // EURC/USD
                236, // USDT/USD
                131, // USDC/USD
                21,  // PAXG/USD
                206, // TBTC/USD
                43,  // WBTC/USD
                4,   // WSTETH/USD
            ]),
        );

        let serialized_updates = legacy_serialize_updates(network, &updates, test_feeds_config());

        // Note: bye is filtered out:
        assert_eq!(
            serialized_updates,
            hex::decode(format!("{selector}0000001f6869000000000000000000000000000000000000000000000000000000000000")).unwrap()
        );

        // Berachain
        let network = "berachain-bartio";

        filter_allowed_feeds(
            network,
            &mut updates,
            &Some(vec![
                31,  // BTC/USD
                47,  // ETH/USD
                65,  // EURC/USD
                236, // USDT/USD
                131, // USDC/USD
                21,  // PAXG/USD
            ]),
        );

        let serialized_updates = legacy_serialize_updates(network, &updates, test_feeds_config());

        assert_eq!(
            serialized_updates,
            hex::decode(format!("{selector}0000001f6869000000000000000000000000000000000000000000000000000000000000")).unwrap()
        );

        // Manta
        let network = "manta-sepolia";

        filter_allowed_feeds(
            network,
            &mut updates,
            &Some(vec![
                31,  // BTC/USD
                47,  // ETH/USD
                236, // USDT/USD
                131, // USDC/USD
                43,  // WBTC/USD
            ]),
        );

        let serialized_updates = legacy_serialize_updates(network, &updates, test_feeds_config());

        assert_eq!(
            serialized_updates,
            hex::decode(format!("{selector}0000001f6869000000000000000000000000000000000000000000000000000000000000")).unwrap()
        );
    }

    fn peg_stable_coin_updates_data() -> BatchedAggegratesToSend {
        let end_slot_timestamp = 0_u128;
        let v1 = VotedFeedUpdate {
            feed_id: 0x1F_u32,
            value: FeedType::Text("hi".to_string()),
            end_slot_timestamp,
        };
        let v2 = VotedFeedUpdate {
            feed_id: 0x0FFF,
            value: FeedType::Text("bye".to_string()),
            end_slot_timestamp,
        };
        let v3 = VotedFeedUpdate {
            feed_id: 0x001_u32,
            value: FeedType::Numerical(1.001f64),
            end_slot_timestamp,
        };

        let v4 = VotedFeedUpdate {
            feed_id: 0x001_u32,
            value: FeedType::Numerical(1.101f64),
            end_slot_timestamp,
        };
        let v5 = VotedFeedUpdate {
            feed_id: 0x001_u32,
            value: FeedType::Numerical(0.991f64),
            end_slot_timestamp,
        };

        BatchedAggegratesToSend {
            block_height: 1,
            updates: vec![v1, v2, v3, v4, v5],
        }
    }

    #[actix_web::test]
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
                    feed_id: 1_u32,
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
            feed_id: 0x001_u32,
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

        provider.apply_publish_criteria(&mut updates);
        assert_eq!(updates.updates.len(), 3);
        assert_eq!(updates.updates[2].value, FeedType::Numerical(1.101f64));
    }

    #[actix_web::test]
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
                    feed_id: 1_u32,
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
            feed_id: 0x001_u32,
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

        provider.apply_publish_criteria(&mut updates);
        assert_eq!(updates.updates.len(), 5);
        assert_eq!(updates.updates[3].value, FeedType::Numerical(1.101f64));
    }
}
