use alloy::{
    hex::FromHex, network::TransactionBuilder, primitives::Bytes, providers::Provider,
    rpc::types::eth::TransactionRequest,
};
use eyre::Result;
// use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::Duration;

use alloy::{dyn_abi::DynSolValue, primitives::Address};

use crate::providers::provider::{RpcProvider, SharedRpcProviders};
use actix_web::rt::spawn;
use eyre::eyre;
use prometheus::process_provider_getter;

use feed_registry::types::Repeatability;
use feed_registry::types::Repeatability::Periodic;
use futures::stream::FuturesUnordered;
use paste::paste;
use prometheus::{inc_metric, inc_metric_by};
use std::fmt::Debug;
use std::time::Instant;
use tracing::info_span;
use tracing::{debug, error, info};

pub async fn deploy_contract(
    network: &String,
    rpc_providers: &SharedRpcProviders,
    feed_type: Repeatability,
) -> Result<String> {
    let rpc_providers = rpc_providers.read().await;

    let rpc_provider = rpc_providers.get(network);
    let Some(p) = rpc_provider.cloned() else {
        return Err(eyre!("No provider for network {}", network));
    };
    drop(rpc_providers);
    let mut p = p.lock().await;
    let wallet = &p.wallet;
    let provider = p.get_current_provider();
    let provider_metrics = &p.provider_metrics;

    // Get the base fee for the block.
    let base_fee = provider.get_gas_price().await?;

    // Deploy the contract.
    let bytecode = if feed_type == Periodic {
        p.data_feed_store_byte_code.clone()
    } else {
        p.data_feed_sports_byte_code.clone()
    };

    let Some(mut bytecode) = bytecode else {
        return Err(eyre!("Byte code unavailable"));
    };

    let max_priority_fee_per_gas = process_provider_getter!(
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

    let message_value = DynSolValue::Tuple(vec![DynSolValue::Address(Address::from_private_key(
        wallet.signer(),
    ))]);

    let mut encoded_arg = message_value.abi_encode();
    bytecode.append(&mut encoded_arg);

    let tx = TransactionRequest::default()
        .from(wallet.address())
        .with_gas_limit(2e5 as u128)
        .with_max_fee_per_gas(base_fee + base_fee)
        .with_max_priority_fee_per_gas(max_priority_fee_per_gas)
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

pub async fn eth_batch_send_to_contract<
    K: Debug + Clone + std::string::ToString + 'static,
    V: Debug + Clone + std::string::ToString + 'static,
>(
    net: String,
    rpc_provider: Arc<Mutex<RpcProvider>>,
    updates: HashMap<K, V>,
    feed_type: Repeatability,
) -> Result<String> {
    let rpc_provider = rpc_provider.lock().await;
    let wallet = &rpc_provider.wallet;
    let contract_address = if feed_type == Periodic {
        rpc_provider
            .contract_address
            .unwrap_or_else(|| panic!("Contract address not set for network {}.", net))
    } else {
        rpc_provider
            .event_contract_address
            .unwrap_or_else(|| panic!("Event contract address not set for network {}.", net))
    };

    info!(
        "sending data to address `{}` in network `{}`",
        contract_address, net
    );

    let provider_metrics = &rpc_provider.provider_metrics;
    let configured_chain_id = rpc_provider.chain_id;
    let provider = rpc_provider.get_current_provider();

    let selector = "0x1a2d80ac";

    let mut keys_vals: String = Default::default();

    for (key, val) in updates.into_iter() {
        keys_vals += key.to_string().as_str();
        keys_vals += val.to_string().as_str();
    }

    let calldata_str = (selector.to_owned() + keys_vals.as_str()).to_string();

    let input = match Bytes::from_hex(calldata_str) {
        Err(e) => panic!("Key is not valid hex string: {}", e), // We panic here, because the http handler on the recv side must filter out wrong input.
        Ok(x) => x,
    };

    let base_fee = process_provider_getter!(
        provider.get_gas_price().await,
        net,
        provider_metrics,
        get_gas_price
    );

    debug!("Observed gas price (base_fee) = {}", base_fee);
    provider_metrics
        .read()
        .await
        .gas_price
        .with_label_values(&[net.as_str()])
        .observe((base_fee as f64) / 1000000000.0);

    let max_priority_fee_per_gas = process_provider_getter!(
        provider.get_max_priority_fee_per_gas().await,
        net,
        provider_metrics,
        get_max_priority_fee_per_gas
    );

    let chain_id = process_provider_getter!(
        provider.get_chain_id().await,
        net,
        provider_metrics,
        get_chain_id
    );

    if chain_id != configured_chain_id {
        error!(
            "Endpoint reported chain ID {chain_id} which does not equal the configured for the network {configured_chain_id}!"
        );
        eyre::bail!("Chain ID mismatch!");
    }

    let tx = TransactionRequest::default()
        .to(contract_address)
        .from(wallet.address())
        .with_gas_limit(2e5 as u128)
        .with_max_fee_per_gas(base_fee + base_fee)
        .with_max_priority_fee_per_gas(max_priority_fee_per_gas)
        .with_chain_id(chain_id)
        .input(Some(input).into());

    let tx_time = Instant::now();

    let receipt_future = process_provider_getter!(
        provider.send_transaction(tx).await,
        net,
        provider_metrics,
        send_tx
    );

    let receipt = process_provider_getter!(
        receipt_future.get_receipt().await,
        net,
        provider_metrics,
        get_receipt
    );

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

    provider_metrics
        .read()
        .await
        .transaction_confirmation_times
        .with_label_values(&[net.as_str()])
        .observe(transaction_time as f64);
    Ok(receipt.status().to_string())
}

pub async fn eth_batch_send_to_all_contracts<
    K: Debug + Clone + std::string::ToString + 'static,
    V: Debug + Clone + std::string::ToString + 'static,
>(
    providers: SharedRpcProviders,
    updates: HashMap<K, V>,
    feed_type: Repeatability,
) -> Result<String> {
    let span = info_span!("eth_batch_send_to_all_contracts");
    let _guard = span.enter();
    debug!("updates: {:?}", updates);

    let providers = providers.read().await;

    let collected_futures = FuturesUnordered::new();

    for (net, p) in
        <HashMap<std::string::String, Arc<tokio::sync::Mutex<RpcProvider>>> as Clone>::clone(
            &providers,
        )
        .into_iter()
    {
        let updates = updates.clone();
        let timeout = p.lock().await.transcation_timeout_secs as u64;
        collected_futures.push(spawn(async move {
            let result = actix_web::rt::time::timeout(
                Duration::from_secs(timeout),
                eth_batch_send_to_contract(net.clone(), p.clone(), updates, feed_type),
            )
            .await;
            (result, net.clone(), p.clone())
        }));
    }

    drop(providers);

    let result = futures::future::join_all(collected_futures).await;
    let mut all_results = String::new();
    for v in result {
        match v {
            Ok(res) => match res {
                (Ok(report), net, provider) => {
                    match report {
                        Ok(result) => {
                            all_results += &format!("success from {} -> {:?}", net, result)
                        }
                        Err(e) => {
                            error!("{}", e.to_string());
                            all_results += &e.to_string();
                            let mut provider = provider.lock().await;
                            provider.switch_provider();
                            let provider_metrics = provider.provider_metrics.clone();
                            inc_metric!(provider_metrics, net, failed_send_tx);
                            inc_metric!(provider_metrics, net, total_times_provider_switched);
                        }
                    };
                }
                (Err(e), net, provider) => {
                    let err = format!("Timed out transaction for network {} -> {}", net, e);
                    error!(err);
                    all_results += &err;
                    let mut provider = provider.lock().await;
                    provider.switch_provider();
                    let provider_metrics = provider.provider_metrics.clone();
                    inc_metric!(provider_metrics, net, total_timed_out_tx);
                    inc_metric!(provider_metrics, net, total_times_provider_switched);
                }
            },
            Err(e) => {
                all_results += "JoinError:";
                error!("JoinError: {}", e.to_string());
                all_results += &e.to_string()
            }
        }
        all_results += "\n"
    }
    Ok(all_results)
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::providers::provider::{can_read_contract_bytecode, init_shared_rpc_providers};
    use alloy::primitives::{Address, TxKind};
    use alloy::rpc::types::eth::TransactionInput;
    use alloy::{node_bindings::Anvil, providers::Provider};
    use feed_registry::types::Repeatability::Oneshot;
    use regex::Regex;
    use sequencer_config::{
        get_test_config_with_multiple_providers, get_test_config_with_single_provider,
    };
    use std::collections::HashMap;
    use std::str::FromStr;
    use tokio::fs::File;
    use tokio::io::AsyncWriteExt;

    fn extract_address(message: &str) -> Option<String> {
        let re = Regex::new(r"0x[a-fA-F0-9]{40}").expect("Invalid regex");
        if let Some(mat) = re.find(message) {
            return Some(mat.as_str().to_string());
        }
        None
    }

    async fn create_priv_key(key_path: &str, private_key: &[u8]) {
        let mut f = File::create(key_path)
            .await
            .expect("Could not create key file");
        f.write(private_key)
            .await
            .expect("Failed to write to temp file");
        f.flush().await.expect("Could not flush temp file");
    }

    #[tokio::test]
    async fn test_deploy_contract_returns_valid_address() {
        // setup
        let anvil = Anvil::new().try_spawn().unwrap();
        let key_path = "/tmp/priv_key_test";
        let private_key = b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356";
        let network = "ETH131";
        create_priv_key(key_path, private_key).await;

        let cfg =
            get_test_config_with_single_provider(network, key_path, anvil.endpoint().as_str());

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

    #[tokio::test]
    async fn test_eth_batch_send_to_oneshot_contract() {
        /////////////////////////////////////////////////////////////////////
        // BIG STEP ONE - Setup Anvil and deploy SportsDataFeedStoreV2 to it
        /////////////////////////////////////////////////////////////////////

        // setup
        let anvil = Anvil::new().try_spawn().unwrap();
        let key_path = "/tmp/priv_key_test";
        let private_key = b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356";
        let network = "ETH333";
        create_priv_key(key_path, private_key).await;

        let cfg =
            get_test_config_with_single_provider(network, key_path, anvil.endpoint().as_str());

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
        let mut updates_oneshot: HashMap<String, String> = HashMap::new();
        updates_oneshot.insert(result_key, result_value);
        let result =
            eth_batch_send_to_contract(net.clone(), provider.clone(), updates_oneshot, Oneshot)
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
            .get_current_provider()
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
        let key_path = "/tmp/priv_key_test";
        let private_key = b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356";
        create_priv_key(key_path, private_key).await;

        let anvil_network1 = Anvil::new().try_spawn().unwrap();
        let network1 = "ETH374";
        let anvil_network2 = Anvil::new().try_spawn().unwrap();
        let network2 = "ETH375";

        let cfg = get_test_config_with_multiple_providers(vec![
            (network1, key_path, anvil_network1.endpoint().as_str()),
            (network2, key_path, anvil_network2.endpoint().as_str()),
        ]);

        let providers =
            init_shared_rpc_providers(&cfg, Some("test_eth_batch_send_to_all_oneshot_contracts_"))
                .await;

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
        let mut updates_oneshot: HashMap<String, String> = HashMap::new();
        updates_oneshot.insert(String::from("00000003"), value1);

        let result = eth_batch_send_to_all_contracts(providers, updates_oneshot, Oneshot).await;
        // TODO: This is actually not a good assertion since the eth_batch_send_to_all_contracts
        // will always return ok even if some or all of the sends we unsuccessful. Will be fixed in
        // followups
        assert!(result.is_ok());
    }
}
