use actix_web::{rt::spawn, web::Data};
use alloy::{
    hex::FromHex,
    network::TransactionBuilder,
    primitives::Bytes,
    providers::{Provider, ProviderBuilder},
    rpc::types::eth::TransactionRequest,
};
use blocksense_registry::config::FeedConfig;
use data_feeds::feeds_processing::VotedFeedUpdate;
use eyre::{eyre, Result};
use std::{collections::HashMap, mem, sync::Arc};
use tokio::{sync::Mutex, sync::RwLock, time::Duration};
use utils::to_hex_string;

use crate::{
    providers::adfs_gen_calldata::adfs_serialize_updates,
    providers::provider::{
        parse_eth_address, ProviderStatus, RpcProvider, SharedRpcProviders,
        EVENT_FEED_CONTRACT_NAME, PRICE_FEED_CONTRACT_NAME,
    },
    sequencer_state::SequencerState,
    BatchedAggegratesToSend,
};
use feed_registry::types::{Repeatability, Repeatability::Periodic};
use futures::stream::FuturesUnordered;
use paste::paste;
use prometheus::{inc_metric, inc_metric_by};
use prometheus::{metrics::FeedsMetrics, process_provider_getter};
use std::time::Instant;
use tracing::{debug, error, info, info_span, warn};

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
async fn legacy_serialize_updates(
    net: &str,
    updates: &BatchedAggegratesToSend,
    feeds_config: Arc<RwLock<HashMap<u32, FeedConfig>>>,
) -> Result<String> {
    let mut result: String = Default::default();

    let selector = "0x1a2d80ac";
    result.push_str(selector);

    info!("Preparing a legacy batch of feeds to network `{net}`");

    let mut num_reported_feeds = 0;
    for update in &updates.updates {
        let feed_id = update.feed_id;
        let feed_config = feeds_config.read().await.get(&feed_id).cloned();

        let digits_in_fraction = match &feed_config {
            Some(f) => f.additional_feed_info.decimals,
            None => {
                warn!("Propagating result for unregistered feed! Support left for legacy one shot feeds of 32 bytes size. Decimale default to 18");
                18
            }
        };

        let (key, val) = update.encode(digits_in_fraction as usize);

        num_reported_feeds += 1;
        result += to_hex_string(key, None).as_str();
        result += to_hex_string(val, Some(32)).as_str(); // TODO: Get size to pad to based on strinde in feed_config. Also check!
    }
    info!("Sending a batch of {num_reported_feeds} feeds to network `{net}`");

    Ok(result)
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
    provider: &Arc<Mutex<RpcProvider>>,
    updates: &mut BatchedAggegratesToSend,
    provider_settings: &config::Provider,
    feeds_metrics: Option<Arc<RwLock<FeedsMetrics>>>,
    feeds_config: Arc<RwLock<HashMap<u32, FeedConfig>>>,
) -> Result<String> {
    debug!("Acquiring a read lock on provider config for `{net}`");
    let provider = provider.lock().await;
    debug!("Acquired a read lock on provider config for `{net}`");
    filter_allowed_feeds(net, updates, &provider_settings.allow_feeds);
    provider.peg_stable_coins_to_value(updates);
    provider.apply_publish_criteria(updates);

    // Don’t post to Smart Contract if we have 0 updates
    if updates.updates.is_empty() {
        return Ok("".to_string());
    }

    let contract_version = provider
        .get_contract(PRICE_FEED_CONTRACT_NAME)
        .ok_or(eyre!("{PRICE_FEED_CONTRACT_NAME} contract is not set!"))?
        .contract_version;
    drop(provider);
    debug!("Released a read lock on provider config for `{net}`");

    let serialized_updates = match contract_version {
        1 => match legacy_serialize_updates(net, updates, feeds_config).await {
            Ok(result) => result,
            Err(e) => eyre::bail!("Legacy serialization failed: {}!", e),
        },
        2 => match adfs_serialize_updates(net, updates, feeds_metrics, feeds_config).await {
            Ok(result) => result,
            Err(e) => eyre::bail!("ADFS serialization failed: {}!", e),
        },
        _ => eyre::bail!("Unsupported contract version set for network {net}!"),
    };

    Ok(serialized_updates)
}

#[allow(clippy::too_many_arguments)]
pub async fn eth_batch_send_to_contract(
    net: String,
    provider: Arc<Mutex<RpcProvider>>,
    provider_settings: config::Provider,
    mut updates: BatchedAggegratesToSend,
    feed_type: Repeatability,
    feeds_metrics: Option<Arc<RwLock<FeedsMetrics>>>,
    feeds_config: Arc<RwLock<HashMap<u32, FeedConfig>>>,
    transaction_retry_timeout_secs: u64,
    retry_fee_increment_fraction: f64,
) -> Result<(String, Vec<u32>)> {
    let serialized_updates = get_serialized_updates_for_network(
        net.as_str(),
        &provider,
        &mut updates,
        &provider_settings,
        feeds_metrics,
        feeds_config,
    )
    .await?;

    if updates.updates.is_empty() {
        info!("Network `{net}` posting to smart contract skipped because it received 0 updates");
        return Ok((format!("No updates to send for network {net}"), Vec::new()));
    }

    debug!(
        "About to post {} updates to smart contract for network `{net}`",
        updates.updates.len()
    );

    debug!("Acquiring a read/write lock on provider state for network `{net}`");
    let mut provider = provider.lock().await;
    debug!("Acquired a read/write lock on provider state for network `{net}`");

    let signer = &provider.signer;
    let contract_name = if feed_type == Periodic {
        PRICE_FEED_CONTRACT_NAME
    } else {
        EVENT_FEED_CONTRACT_NAME
    };
    let contract_address = provider.get_contract_address(contract_name)?;
    info!(
        "sending data to address `{}` in network `{}`",
        contract_address, net
    );

    let provider_metrics = &provider.provider_metrics;
    let rpc_handle = &provider.provider;

    let calldata_str = serialized_updates;

    let input =
        Bytes::from_hex(calldata_str).map_err(|e| eyre!("Key is not valid hex string: {}", e))?;

    debug!("Observing gas price (base_fee) for network {net}...");
    let base_fee = process_provider_getter!(
        rpc_handle.get_gas_price().await,
        net,
        provider_metrics,
        get_gas_price
    );
    debug!("Observed gas price (base_fee) for network {net} = {base_fee}");

    debug!("Acquiring a read lock on provider_metrics for network `{net}`");
    provider_metrics
        .read()
        .await
        .gas_price
        .with_label_values(&[net.as_str()])
        .observe((base_fee as f64) / 1000000000.0);
    debug!("Acquired and released a read lock on provider_metrics for network `{net}`");

    debug!("Getting chain_id for network {net}...");
    let chain_id = process_provider_getter!(
        rpc_handle.get_chain_id().await,
        net,
        provider_metrics,
        get_chain_id
    );
    debug!("Got chain_id={chain_id} for network {net}");

    let receipt;
    let tx_time = Instant::now();

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

    let mut timed_out_count = 0;

    loop {
        debug!("loop begin; timed_out_count={timed_out_count}");
        let tx;
        if timed_out_count == 0 {
            tx = TransactionRequest::default()
                .to(contract_address)
                .from(sender_address)
                .with_chain_id(chain_id)
                .input(Some(input.clone()).into());
            debug!("Sending initial tx: {tx:?}");
        } else {
            debug!("Getting nonce for network {net} and address {contract_address}...");
            let mut nonce = match rpc_handle
                .get_transaction_count(contract_address)
                .latest()
                .await
            {
                Ok(nonce) => {
                    debug!("Got nonce={nonce} for network {net} and address {contract_address}");
                    nonce
                }
                Err(err) => {
                    debug!("Failed to get nonce for network {net} and address {contract_address} due to {err}");
                    return Err(err.into());
                }
            };

            // TODO: remove previous, if this fixes nonce=1
            if nonce == 1 {
                debug!("Getting nonce for network {net} and address {sender_address}...");
                nonce = match rpc_handle
                    .get_transaction_count(sender_address)
                    .latest()
                    .await
                {
                    Ok(nonce) => {
                        debug!("Got nonce={nonce} for network {net} and address {sender_address}");
                        nonce
                    }
                    Err(err) => {
                        debug!("Failed to get nonce for network {net} and address {sender_address} due to {err}");
                        return Err(err.into());
                    }
                };
            }

            let price_increment = 1.0 + (timed_out_count as f64 * retry_fee_increment_fraction);

            debug!("Getting gas_price for network {net}...");
            let gas_price = match rpc_handle.get_gas_price().await {
                Ok(gas_price) => {
                    debug!("Got gas_price={gas_price} for network {net}");
                    gas_price
                }
                Err(err) => {
                    debug!("Failed to get gas_price for network {net} due to {err}");
                    return Err(err.into());
                }
            };

            debug!("Getting priority_fee for network {net}...");
            let mut priority_fee = match rpc_handle.get_max_priority_fee_per_gas().await {
                Ok(priority_fee) => {
                    debug!("Got priority_fee={priority_fee} for network {net}");
                    priority_fee
                }
                Err(err) => {
                    debug!("Failed to get priority_fee for network {net} due to {err}");
                    return Err(err.into());
                }
            };

            priority_fee = (priority_fee as f64 * price_increment) as u128;
            let mut max_fee_per_gas = gas_price + gas_price + priority_fee;
            max_fee_per_gas = (max_fee_per_gas as f64 * price_increment) as u128;
            tx = TransactionRequest::default()
                .to(contract_address)
                .nonce(nonce)
                .from(sender_address)
                .max_fee_per_gas(max_fee_per_gas)
                .max_priority_fee_per_gas(priority_fee)
                .with_chain_id(chain_id)
                .input(Some(input.clone()).into());
            debug!("Retrying for {timed_out_count}-th time tx: {tx:?}");
        }

        let tx_str = format!("{tx:?}");
        debug!("tx_str={tx_str}");

        let tx_result = if is_impersonated {
            let rpc_url = rpc_handle.client().transport().url().parse()?;
            let rpc_handle = ProviderBuilder::new().on_http(rpc_url);
            debug!("Sending impersonated price feed update transaction to network `{net}`...");
            let result = rpc_handle.send_transaction(tx).await;
            debug!("Sent impersonated price feed update transaction to network `{net}`");
            result
        } else {
            debug!("Sending price feed update transaction to network `{net}`...");
            let result = rpc_handle.send_transaction(tx).await;
            debug!("Sent price feed update transaction to network `{net}`");
            result
        };

        let tx_result_str = format!("{tx_result:?}");
        debug!("tx_result_str={tx_result_str}");

        let receipt_future = process_provider_getter!(tx_result, net, provider_metrics, send_tx);

        debug!("Awaiting receipt for transaction to network `{net}`...");
        let receipt_result = spawn(async move {
            actix_web::rt::time::timeout(
                Duration::from_secs(transaction_retry_timeout_secs),
                receipt_future.get_receipt(),
            )
            .await
        })
        .await;
        debug!("Done awaiting receipt for transaction to network `{net}`");

        debug!("matching receipt_result...");

        match receipt_result {
            Ok(outer_result) => match outer_result {
                Ok(inner_result) => match inner_result {
                    Ok(r) => {
                        debug!("Received valid receipt for transaction to network `{net}`");
                        receipt = r;
                        break;
                    }
                    Err(e) => {
                        warn!("PendingTransactionError tx={tx_str}, tx_result={tx_result_str}, network={net}: {e}");
                        timed_out_count += 1;
                    }
                },
                Err(e) => {
                    warn!("Timed out tx={tx_str}, tx_result={tx_result_str}, network={net}: {e}");
                    timed_out_count += 1;
                }
            },
            Err(e) => {
                panic!("Join error tx={tx_str}, tx_result={tx_result_str}, network={net}: {e}");
            }
        }

        debug!("matched receipt_result");
    }

    let transaction_time = tx_time.elapsed().as_millis();
    info!(
        "Recvd transaction receipt that took {}ms from `{}`: {:?}",
        transaction_time, net, receipt
    );
    inc_metric!(provider_metrics, net, total_tx_sent);
    let gas_used_inc = receipt.gas_used;
    inc_metric_by!(provider_metrics, net, gas_used, gas_used_inc);
    let effective_gas_price_inc = receipt.effective_gas_price;
    inc_metric_by!(
        provider_metrics,
        net,
        effective_gas_price,
        effective_gas_price_inc
    );

    let tx_hash = receipt.transaction_hash;
    let tx_fee = receipt.gas_used * receipt.effective_gas_price;
    let tx_fee = (tx_fee as f64) / 1e18;
    info!("Transaction with hash {tx_hash} on `{net}` cost {tx_fee} ETH");

    debug!("Acquiring a read lock on provider_metrics for network `{net}`");
    provider_metrics
        .read()
        .await
        .transaction_confirmation_times
        .with_label_values(&[net.as_str()])
        .observe(transaction_time as f64);
    debug!("Acquired and released a read lock on provider_metrics for network `{net}`");

    provider.update_history(&updates.updates);
    drop(provider);
    debug!("Released a read/write lock on provider state for network `{net}`");

    let feeds_to_update_ids = updates
        .updates
        .iter()
        .map(|update| update.feed_id)
        .collect();

    Ok((receipt.status().to_string(), feeds_to_update_ids))
}

pub async fn eth_batch_send_to_all_contracts(
    sequencer_state: Data<SequencerState>,
    updates: BatchedAggegratesToSend,
    feed_type: Repeatability,
) -> Result<String> {
    let span = info_span!("eth_batch_send_to_all_contracts");
    let _guard = span.enter();
    debug!("updates: {:?}", updates.updates);

    let collected_futures = FuturesUnordered::new();

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
        let feeds_metrics = sequencer_state.feeds_metrics.clone();
        let feeds_config = sequencer_state.active_feeds.clone();

        for (net, provider) in providers.iter() {
            let updates = updates.clone();
            let (
                transaction_drop_timeout_secs,
                transaction_retry_timeout_secs,
                retry_fee_increment_fraction,
            ) = {
                debug!("Acquiring a read lock on provider for network {net}");
                let p = provider.lock().await;
                debug!("Acquired and releasing a read lock on provider for network {net}");
                (
                    p.transaction_drop_timeout_secs as u64,
                    p.transaction_retry_timeout_secs as u64,
                    p.retry_fee_increment_fraction,
                )
            };

            let net = net.clone();

            if let Some(provider_settings) = providers_config.get(&net) {
                if !provider_settings.is_enabled {
                    warn!("Network `{net}` is not enabled; skipping it during reporting");
                    continue;
                } else {
                    info!("Network `{net}` is enabled; reporting...");
                }

                let updates = updates.clone();
                let provider = provider.clone();

                let feeds_config = feeds_config.clone();
                let feeds_metrics = feeds_metrics.clone();
                let provider_settings = provider_settings.clone();
                collected_futures.push(spawn(async move {
                    let result = actix_web::rt::time::timeout(
                        Duration::from_secs(transaction_drop_timeout_secs),
                        eth_batch_send_to_contract(
                            net.clone(),
                            provider.clone(),
                            provider_settings,
                            updates,
                            feed_type,
                            Some(feeds_metrics),
                            feeds_config,
                            transaction_retry_timeout_secs,
                            retry_fee_increment_fraction,
                        ),
                    )
                    .await;
                    (result, net, provider)
                }));
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

    if collected_futures.is_empty() {
        warn!("There are no enabled networks; not reporting to anybody");
    }

    let result = futures::future::join_all(collected_futures).await;
    let mut all_results = String::new();
    for v in result {
        let res = match v {
            Ok(res) => res,
            Err(e) => {
                all_results += "JoinError:";
                error!("JoinError: {}", e.to_string());
                all_results += &e.to_string();
                continue;
            }
        };

        let (x, net) = match res {
            (Ok(x), net, _provider) => (x, net),
            (Err(e), net, provider) => {
                let err = format!("Timed out transaction for network {} -> {}", net, e);
                error!(err);
                all_results += &err;
                let provider = provider.lock().await;
                let provider_metrics = provider.provider_metrics.clone();
                inc_metric!(provider_metrics, net, total_timed_out_tx);
                let mut status_map = sequencer_state.provider_status.write().await;
                status_map.insert(net, ProviderStatus::LastUpdateFailed);
                continue;
            }
        };

        let (status, updated_feeds) = match x {
            Ok((status, updated_feeds)) => (status, updated_feeds),
            Err(error_message) => {
                warn!("Network {net} responded with error: {error_message}");
                all_results += &format!("result from network {}: Err -> {:?}", net, error_message);
                let mut status_map = sequencer_state.provider_status.write().await;
                status_map.insert(net, ProviderStatus::LastUpdateFailed);
                continue;
            }
        };

        // Transaction confirmed, process the status:
        all_results += &format!("result from network {net}: Ok -> status: {status}");
        if status == "true" {
            all_results += &format!(", updated_feeds: {updated_feeds:?}");
            for feed in updated_feeds {
                // update the round counters accordingly
                sequencer_state
                    .feeds_metrics
                    .read()
                    .await
                    .updates_to_networks
                    .with_label_values(&[&feed.to_string(), &net])
                    .inc();
            }
        }
        let mut status_map = sequencer_state.provider_status.write().await;
        status_map.insert(net, ProviderStatus::LastUpdateSucceeded);

        all_results += "\n"
    }
    Ok(all_results)
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::http_handlers::data_feeds::tests::some_feed_config_with_id_1;
    use crate::providers::provider::init_shared_rpc_providers;
    use crate::sequencer_state::create_sequencer_state_from_sequencer_config;
    use alloy::primitives::{Address, TxKind};
    use alloy::rpc::types::eth::TransactionInput;
    use alloy::{node_bindings::Anvil, providers::Provider};
    use config::{
        get_test_config_with_multiple_providers, get_test_config_with_single_provider, AssetPair,
    };
    use config::{AllFeedsConfig, PublishCriteria};
    use data_feeds::feeds_processing::VotedFeedUpdate;
    use feed_registry::types::Repeatability::Oneshot;
    use regex::Regex;
    use std::str::FromStr;
    use std::time::SystemTime;
    use utils::test_env::get_test_private_key_path;

    fn extract_address(message: &str) -> Option<String> {
        let re = Regex::new(r"0x[a-fA-F0-9]{40}").expect("Invalid regex");
        if let Some(mat) = re.find(message) {
            return Some(mat.as_str().to_string());
        }
        None
    }

    fn test_feeds_config() -> Arc<RwLock<HashMap<u32, FeedConfig>>> {
        let mut feeds_config = HashMap::new();
        feeds_config.insert(
            0,
            FeedConfig {
                id: 0,
                name: "FOXY".to_string(),
                full_name: "Foxy".to_string(),
                description: "FOXY / USD".to_string(),
                decimals: 18,
                report_interval_ms: 90000,
                quorum_percentage: 100.0,
                skip_publish_if_less_then_percentage: 0.1,
                always_publish_heartbeat_ms: Some(3600000),
                _type: "Crypto".to_string(),
                script: "CoinMarketCap".to_string(),
                pair: AssetPair {
                    base: "FOXY".to_string(),
                    quote: "USD".to_string(),
                },
                first_report_start_time: SystemTime::now(),
                resources: HashMap::new(),
                value_type: "Numerical".to_string(),
                aggregate_type: "Median".to_string(),
                stride: 0,
            },
        );
        Arc::new(RwLock::new(feeds_config))
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
        let feed_1_config = some_feed_config_with_id_1();
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
        let payload: String = format!("{}{}", slot1, slot2);
        let description =
            String::from("0000000000000000000000000000000000000000000000000000000000000000");
        let result_value = format!("{}{}{}", number_of_slots, payload, description);

        let end_slot_timestamp = 0_u128;
        let voted_update = VotedFeedUpdate::new_decode(
            &result_key,
            &result_value,
            end_slot_timestamp,
            feed_registry::types::FeedType::Numerical(0.0f64),
            18,
        )
        .unwrap();
        let updates_oneshot = BatchedAggegratesToSend {
            block_height: 0,
            updates: vec![voted_update],
            proofs: HashMap::new(),
        };
        let provider_settings = cfg
            .providers
            .get(&net)
            .expect(format!("Config for network {net} not found!").as_str())
            .clone();
        let feeds_config = Arc::new(RwLock::new(HashMap::<u32, FeedConfig>::new()));

        let result = eth_batch_send_to_contract(
            net.clone(),
            provider.clone(),
            provider_settings,
            updates_oneshot,
            Oneshot,
            None,
            feeds_config,
            50,
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
            .call(&TransactionRequest {
                to: Some(TxKind::Call(address_to_send)),
                input: TransactionInput {
                    input: Some(calldata_bytes.clone()),
                    data: Some(calldata_bytes.clone()),
                },
                ..Default::default()
            })
            .await;
        println!("@@0b result: {:?}", result);
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
            feeds: vec![some_feed_config_with_id_1()],
        };
        let (sequencer_state, _, _, _, _) = create_sequencer_state_from_sequencer_config(
            sequencer_config,
            metrics_prefix,
            feeds_config,
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
                &"00000003",
                &value1,
                end_of_timeslot,
                FeedType::Text("".to_string()),
                18,
            )
            .unwrap()],
            proofs: HashMap::new(),
        };

        let result =
            eth_batch_send_to_all_contracts(sequencer_state, updates_oneshot, Oneshot).await;
        // TODO: This is actually not a good assertion since the eth_batch_send_to_all_contracts
        // will always return ok even if some or all of the sends we unsuccessful. Will be fixed in
        // followups
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn compute_keys_vals_ignores_networks_not_on_the_list() {
        let selector = "0x1a2d80ac";
        let network = "dont_filter_me";
        let mut updates = BatchedAggegratesToSend {
            block_height: 0,
            updates: get_updates_test_data(),
            proofs: HashMap::new(),
        };
        filter_allowed_feeds(network, &mut updates, &None);
        let serialized_updates = legacy_serialize_updates(network, &updates, test_feeds_config())
            .await
            .expect("Serialize updates failed!");

        let a = "0000001f6869000000000000000000000000000000000000000000000000000000000000";
        let b = "00000fff6279650000000000000000000000000000000000000000000000000000000000";
        let ab = format!("{selector}{a}{b}");
        let ba = format!("{selector}{b}{a}");
        // It is undeterministic what the order will be, so checking both possibilities.
        assert!(ab == serialized_updates || ba == serialized_updates);
    }
    use feed_registry::types::FeedType;

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
            proofs: HashMap::new(),
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

        let serialized_updates = legacy_serialize_updates(network, &updates, test_feeds_config())
            .await
            .expect("Serialize updates failed!");

        // Note: bye is filtered out:
        assert_eq!(
            serialized_updates,
            format!("{selector}0000001f6869000000000000000000000000000000000000000000000000000000000000")
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

        let serialized_updates = legacy_serialize_updates(network, &updates, test_feeds_config())
            .await
            .expect("Serialize updates failed!");

        assert_eq!(
            serialized_updates,
            format!("{selector}0000001f6869000000000000000000000000000000000000000000000000000000000000")
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

        let serialized_updates = legacy_serialize_updates(network, &updates, test_feeds_config())
            .await
            .expect("Serialize updates failed!");

        assert_eq!(
            serialized_updates,
            format!("{selector}0000001f6869000000000000000000000000000000000000000000000000000000000000")
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
            proofs: HashMap::new(),
        }
    }

    #[actix_web::test]
    async fn peg_stable_coin_updates() {
        let network = "ETH";
        let url = "http://localhost:8545";
        let key_path = get_test_private_key_path();

        let mut sequencer_config =
            get_test_config_with_single_provider(network, key_path.as_path(), &url);

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

        let feed = some_feed_config_with_id_1();
        let feeds_config: AllFeedsConfig = AllFeedsConfig {
            feeds: vec![feed.clone()],
        };
        let providers = init_shared_rpc_providers(
            &sequencer_config,
            Some(&"peg_stable_coin_updates_"),
            &feeds_config,
        )
        .await;
        let mut prov2 = providers.write().await;
        let mut provider = prov2.get_mut(network).unwrap().lock().await;

        provider.update_history(&vec![VotedFeedUpdate {
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
            get_test_config_with_single_provider(network, key_path.as_path(), &url);

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
        let feed = some_feed_config_with_id_1();
        let feeds_config: AllFeedsConfig = AllFeedsConfig {
            feeds: vec![feed.clone()],
        };
        let providers = init_shared_rpc_providers(
            &sequencer_config,
            Some(&"peg_stable_coin_updates_disabled"),
            &feeds_config,
        )
        .await;
        let mut prov2 = providers.write().await;
        let mut provider = prov2.get_mut(network).unwrap().lock().await;

        provider.update_history(&vec![VotedFeedUpdate {
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
