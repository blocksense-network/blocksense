use crate::{
    providers::{
        adfs_gen_calldata::adfs_serialize_updates,
        provider::{parse_eth_address, ProviderStatus},
    },
    sequencer_state::SequencerState,
    UpdateToSend,
};
use actix_web::{rt::spawn, web::Data};
use alloy::{
    dyn_abi::DynSolValue,
    hex::FromHex,
    network::TransactionBuilder,
    primitives::Bytes,
    providers::{Provider, ProviderBuilder},
    rpc::types::eth::TransactionRequest,
};
use config::FeedConfig;
use data_feeds::feeds_processing::VotedFeedUpdate;
use eyre::{eyre, Result};
use std::{collections::HashMap, sync::Arc};
use tokio::{sync::Mutex, sync::RwLock, time::Duration};
use utils::to_hex_string;

use crate::providers::provider::{RpcProvider, SharedRpcProviders};
use prometheus::{metrics::FeedsMetrics, process_provider_getter};

use feed_registry::types::{Repeatability, Repeatability::Periodic};
use futures::stream::FuturesUnordered;
use paste::paste;
use prometheus::{inc_metric, inc_metric_by};
use std::time::Instant;
use tracing::{debug, error, info, info_span, warn};

pub async fn deploy_contract(
    network: &String,
    providers: &SharedRpcProviders,
    feed_type: Repeatability,
) -> Result<String> {
    let providers = providers.read().await;

    let provider = providers.get(network);
    let Some(p) = provider.cloned() else {
        return Err(eyre!("No provider for network {}", network));
    };
    drop(providers);
    let mut p = p.lock().await;
    let signer = &p.signer;
    let provider = &p.provider;
    let provider_metrics = &p.provider_metrics;

    // Deploy the contract.
    let bytecode = if feed_type == Periodic {
        p.data_feed_store_byte_code.clone()
    } else {
        p.data_feed_sports_byte_code.clone()
    };

    let Some(mut bytecode) = bytecode else {
        return Err(eyre!("Byte code unavailable"));
    };

    let _max_priority_fee_per_gas = process_provider_getter!(
        provider.get_max_priority_fee_per_gas().await,
        network,
        provider_metrics,
        get_max_priority_fee_per_gas
    );

    let chain_id = process_provider_getter!(
        provider.get_chain_id().await,
        network,
        provider_metrics,
        get_chain_id
    );

    let message_value = DynSolValue::Tuple(vec![DynSolValue::Address(signer.address())]);

    let mut encoded_arg = message_value.abi_encode();
    bytecode.append(&mut encoded_arg);

    let tx = TransactionRequest::default()
        .from(signer.address())
        .with_chain_id(chain_id)
        .with_deploy_code(bytecode);

    let deploy_time = Instant::now();
    let contract_address = provider
        .send_transaction(tx)
        .await?
        .get_receipt()
        .await?
        .contract_address
        .expect("Failed to get contract address");

    info!(
        "Deployed {:?} contract at address: {:?} took {}ms\n",
        feed_type,
        contract_address.to_string(),
        deploy_time.elapsed().as_millis()
    );

    if feed_type == Periodic {
        p.contract_address = Some(contract_address);
    } else {
        p.event_contract_address = Some(contract_address);
    }

    Ok(format!("CONTRACT_ADDRESS set to {}", contract_address))
}

/// Serializes the `updates` hash map into a string.
fn legacy_serialize_updates(net: &str, updates: &UpdateToSend) -> Result<String> {
    let mut result: String = Default::default();

    let selector = "0x1a2d80ac";
    result.push_str(selector);

    info!("Preparing a legacy batch of feeds to network `{net}`");

    let mut num_reported_feeds = 0;
    for (key, val) in updates.updates.iter().map(|update| update.encode()) {
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
    updates: UpdateToSend,
    allow_feeds: &Option<Vec<u32>>,
) -> UpdateToSend {
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
        UpdateToSend {
            block_height: updates.block_height,
            updates: res,
        }
    } else {
        updates
    }
}

pub async fn eth_batch_send_to_contract(
    net: String,
    provider: Arc<Mutex<RpcProvider>>,
    provider_settings: config::Provider,
    updates: UpdateToSend,
    feed_type: Repeatability,
    feeds_metrics: Option<Arc<RwLock<FeedsMetrics>>>,
    feeds_config: Arc<RwLock<HashMap<u32, FeedConfig>>>,
    transaction_retry_timeout_secs: u64,
    retry_fee_increment_fraction: f64,
) -> Result<(String, Vec<u32>)> {
    let updates = {
        let provider = provider.lock().await;
        let updates = filter_allowed_feeds(&net, updates, &provider_settings.allow_feeds);
        let updates = provider.apply_publish_criteria(updates);

        // Don’t post to Smart Contract if we have 0 updates
        if updates.updates.is_empty() {
            info!(
                "Network `{net}` posting to smart contract skipped because it received 0 updates"
            );
            return Ok((
                "skipped due to 0 feeds that need update".to_string(),
                vec![],
            ));
        }

        updates
    };

    let feeds_to_update_ids = updates
        .updates
        .iter()
        .map(|update| update.feed_id)
        .collect();

    let serialized_updates = match provider.lock().await.contract_version {
        1 => legacy_serialize_updates(&net, &updates)?,
        2 => match adfs_serialize_updates(&net, &updates, feeds_metrics, feeds_config).await {
            Ok(result) => result,
            Err(e) => eyre::bail!("ADFS serialization failed: {}!", e),
        },
        _ => eyre::bail!("Unsupported contract version set for network {net}!"),
    };

    let mut provider = provider.lock().await;
    let signer = &provider.signer;
    let contract_address = if feed_type == Periodic {
        provider.contract_address.ok_or(eyre!(
            "[retry test] Contract address not set for network {net}."
        ))
    } else {
        provider.event_contract_address.ok_or(eyre!(
            "[retry test] Event contract address not set for network {net}."
        ))
    }?;

    info!(
        "[retry test] sending data to address `{}` in network `{}`",
        contract_address, net
    );

    let provider_metrics = &provider.provider_metrics;
    let prov = &provider.provider;

    let calldata_str = serialized_updates;

    let input = Bytes::from_hex(calldata_str)
        .map_err(|e| eyre!("[retry test] Key is not valid hex string: {}", e))?;

    let base_fee = process_provider_getter!(
        prov.get_gas_price().await,
        net,
        provider_metrics,
        get_gas_price
    );

    debug!("[retry test] Observed gas price (base_fee) for network {net} = {base_fee}");
    provider_metrics
        .read()
        .await
        .gas_price
        .with_label_values(&[net.as_str()])
        .observe((base_fee as f64) / 1000000000.0);

    let _max_priority_fee_per_gas = process_provider_getter!(
        prov.get_max_priority_fee_per_gas().await,
        net,
        provider_metrics,
        get_max_priority_fee_per_gas
    );

    let chain_id = process_provider_getter!(
        prov.get_chain_id().await,
        net,
        provider_metrics,
        get_chain_id
    );

    let receipt;
    let tx_time = Instant::now();

    let (sender_address, is_impersonated) = match &provider_settings.impersonated_anvil_account {
        Some(impersonated_anvil_account) => {
            debug!(
                "[retry test] Using impersonated anvil account with address: {}",
                impersonated_anvil_account
            );
            (parse_eth_address(impersonated_anvil_account).unwrap(), true)
        }
        None => {
            debug!("[retry test] Using signer address: {}", signer.address());
            (signer.address(), false)
        }
    };

    let mut timed_out_count = 0;

    loop {
        info!("[retry test] loop begin; timed_out_count={timed_out_count}");
        let tx;
        if timed_out_count == 0 {
            tx = TransactionRequest::default()
                .to(contract_address)
                .from(sender_address)
                .with_chain_id(chain_id)
                .input(Some(input.clone()).into());
        } else {
            let nonce = prov
                .get_transaction_count(contract_address.clone())
                .latest()
                .await?;
            let price_increment = 1.0 + (timed_out_count as f64 * retry_fee_increment_fraction);
            let gas_price = prov.get_gas_price().await?;
            let mut priority_fee = prov.get_max_priority_fee_per_gas().await?;
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
        }

        let tx_str = format!("{tx:?}");
        info!("[retry test] tx_str={tx_str}");

        let tx_result = if is_impersonated {
            let rpc_url = prov.client().transport().url().parse()?;
            let provider = ProviderBuilder::new().on_http(rpc_url);
            provider.send_transaction(tx).await
        } else {
            prov.send_transaction(tx).await
        };

        let tx_result_str = format!("{tx_result:?}");
        info!("[retry test] tx_result_str={tx_result_str}");

        let receipt_future = process_provider_getter!(tx_result, net, provider_metrics, send_tx);

        let receipt_result = spawn(async move {
            let result = actix_web::rt::time::timeout(
                Duration::from_secs(transaction_retry_timeout_secs),
                receipt_future.get_receipt(),
            )
            .await;
            result
        })
        .await;

        info!("[retry test] matching receipt_result...");

        match receipt_result {
            Ok(outer_result) => match outer_result {
                Ok(inner_result) => match inner_result {
                    Ok(r) => {
                        receipt = r;
                        break;
                    }
                    Err(e) => {
                        warn!("[retry test] PendingTransactionError tx={tx_str}, tx_result={tx_result_str}: {e}");
                        timed_out_count += 1;
                    }
                },
                Err(e) => {
                    warn!("[retry test] Timed out  tx={tx_str}, tx_result={tx_result_str}: {e}");
                    timed_out_count += 1;
                }
            },
            Err(e) => {
                panic!("[retry test] Join error tx={tx_str}, tx_result={tx_result_str}: {e}");
            }
        }

        info!("[retry test] matched receipt_result");
    }

    let transaction_time = tx_time.elapsed().as_millis();
    info!(
        "[retry test] Recvd transaction receipt that took {}ms from `{}`: {:?}",
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
    info!("[retry test] Transaction with hash {tx_hash} on `{net}` cost {tx_fee} ETH");

    provider_metrics
        .read()
        .await
        .transaction_confirmation_times
        .with_label_values(&[net.as_str()])
        .observe(transaction_time as f64);

    provider.update_history(&updates.updates);
    Ok((receipt.status().to_string(), feeds_to_update_ids))
}

pub async fn eth_batch_send_to_all_contracts(
    sequencer_state: Data<SequencerState>,
    updates: UpdateToSend,
    feed_type: Repeatability,
) -> Result<String> {
    let span = info_span!("eth_batch_send_to_all_contracts");
    let _guard = span.enter();
    debug!("updates: {:?}", updates.updates);

    let collected_futures = FuturesUnordered::new();

    // drop all the locks as soon as we are done using the data
    {
        // Locks acquired here
        let providers = sequencer_state.providers.read().await;
        let providers_config = sequencer_state.sequencer_config.read().await;
        let providers_config = &providers_config.providers;

        // No lock, we propagete the shared objects to the created futures
        let feeds_metrics = sequencer_state.feeds_metrics.clone();
        let feeds_config = sequencer_state.active_feeds.clone();

        for (net, p) in providers.iter() {
            let updates = updates.clone();
            let (
                transaction_drop_timeout_secs,
                transaction_retry_timeout_secs,
                retry_fee_increment_fraction,
            ) = {
                let p = p.lock().await;
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
                let provider = p.clone();

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

    use crate::providers::provider::{can_read_contract_bytecode, init_shared_rpc_providers};
    use crate::testing::sequencer_state::create_sequencer_state_from_sequencer_config_file;
    use alloy::primitives::{Address, TxKind};
    use alloy::rpc::types::eth::TransactionInput;
    use alloy::{node_bindings::Anvil, providers::Provider};
    use config::{get_test_config_with_multiple_providers, get_test_config_with_single_provider};
    use data_feeds::feeds_processing::VotedFeedUpdate;
    use feed_registry::types::Repeatability::Oneshot;
    use regex::Regex;
    use std::str::FromStr;
    use tokio::sync::mpsc;
    use utils::test_env::get_test_private_key_path;

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

        let cfg = get_test_config_with_single_provider(
            network,
            key_path.as_path(),
            anvil.endpoint().as_str(),
        );

        // give some time for cleanup env variables
        let providers =
            init_shared_rpc_providers(&cfg, Some("test_deploy_contract_returns_valid_address_"))
                .await;

        // run
        let result = deploy_contract(&String::from(network), &providers, Periodic).await;
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
            let can_get_bytecode = can_read_contract_bytecode(provider, &extracted_address).await;
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

        let providers =
            init_shared_rpc_providers(&cfg, Some("test_eth_batch_send_to_oneshot_contract_")).await;

        // run
        let result = deploy_contract(&String::from(network), &providers, Oneshot).await;
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
        )
        .unwrap();
        let updates_oneshot = UpdateToSend {
            block_height: 0,
            updates: vec![voted_update],
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
        let address_to_send = provider.lock().await.event_contract_address.unwrap();
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
        /////////////////////////////////////////////////////////////////////
        // BIG STEP ONE - Setup Anvil and deploy SportsDataFeedStoreV2 to it
        /////////////////////////////////////////////////////////////////////

        // setup
        let key_path = get_test_private_key_path();

        let anvil_network1 = Anvil::new().try_spawn().unwrap();
        let network1 = "ETH374";
        let anvil_network2 = Anvil::new().try_spawn().unwrap();
        let network2 = "ETH375";

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
        ]);

        let providers = init_shared_rpc_providers(
            &sequencer_config,
            Some("test_eth_batch_send_to_all_oneshot_contracts_"),
        )
        .await;

        let anvil = Anvil::new().try_spawn().unwrap();
        let key_path = get_test_private_key_path();
        let network = "ETH_test_eth_batch_send_to_all_oneshot_contracts";

        let (vote_send, _) = mpsc::unbounded_channel();
        let sequencer_state = create_sequencer_state_from_sequencer_config_file(
            network,
            key_path.as_path(),
            anvil.endpoint().as_str(),
            Some(vote_send),
            Some(sequencer_config),
        )
        .await;

        let mut actual_providers = sequencer_state.providers.write().await;
        let providers_contents = providers.read().await;
        for (k, v) in providers_contents.iter() {
            actual_providers.insert(k.clone(), v.clone());
        }
        drop(providers_contents);
        drop(actual_providers);

        // run
        let result = deploy_contract(&String::from(network1), &providers, Oneshot).await;
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

        let result = deploy_contract(&String::from(network2), &providers, Oneshot).await;
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

        // Updates for Oneshot
        let slot1 =
            String::from("0404040404040404040404040404040404040404040404040404040404040404");
        let slot2 =
            String::from("0505050505050505050505050505050505050505050505050505050505050505");
        let value1 = format!("{:04x}{}{}", 0x0002, slot1, slot2);
        let end_of_timeslot = 0_u128;
        let updates_oneshot = UpdateToSend {
            block_height: 0,
            updates: vec![VotedFeedUpdate::new_decode(
                &"00000003",
                &value1,
                end_of_timeslot,
                FeedType::Text("".to_string()),
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

    #[test]
    fn compute_keys_vals_ignores_networks_not_on_the_list() {
        let selector = "0x1a2d80ac";
        let network = "dont_filter_me";
        let updates = UpdateToSend {
            block_height: 0,
            updates: get_updates_test_data(),
        };
        let serialized_updates =
            legacy_serialize_updates(network, &filter_allowed_feeds(network, updates, &None))
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
    #[test]
    fn compute_keys_vals_filters_updates_for_networks_on_the_list() {
        let selector = "0x1a2d80ac";
        // Citrea
        let network = "citrea-testnet";

        let updates = UpdateToSend {
            block_height: 0,
            updates: get_updates_test_data(),
        };

        let serialized_updates = legacy_serialize_updates(
            network,
            &filter_allowed_feeds(
                network,
                updates.clone(),
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
            ),
        )
        .expect("Serialize updates failed!");

        // Note: bye is filtered out:
        assert_eq!(
            serialized_updates,
            format!("{selector}0000001f6869000000000000000000000000000000000000000000000000000000000000")
        );

        // Berachain
        let network = "berachain-bartio";

        let serialized_updates = legacy_serialize_updates(
            network,
            &filter_allowed_feeds(
                network,
                updates.clone(),
                &Some(vec![
                    31,  // BTC/USD
                    47,  // ETH/USD
                    65,  // EURC/USD
                    236, // USDT/USD
                    131, // USDC/USD
                    21,  // PAXG/USD
                ]),
            ),
        )
        .expect("Serialize updates failed!");

        assert_eq!(
            serialized_updates,
            format!("{selector}0000001f6869000000000000000000000000000000000000000000000000000000000000")
        );

        // Manta
        let network = "manta-sepolia";

        let serialized_updates = legacy_serialize_updates(
            network,
            &filter_allowed_feeds(
                network,
                updates.clone(),
                &Some(vec![
                    31,  // BTC/USD
                    47,  // ETH/USD
                    236, // USDT/USD
                    131, // USDC/USD
                    43,  // WBTC/USD
                ]),
            ),
        )
        .expect("Serialize updates failed!");

        assert_eq!(
            serialized_updates,
            format!("{selector}0000001f6869000000000000000000000000000000000000000000000000000000000000")
        );
    }
}
