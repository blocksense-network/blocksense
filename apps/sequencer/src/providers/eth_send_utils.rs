use alloy::{
    hex::FromHex, network::TransactionBuilder, primitives::Bytes, providers::Provider,
    rpc::types::eth::TransactionRequest, sol,
};
use eyre::Result;
// use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::Duration;

use crate::providers::provider::{RpcProvider, SharedRpcProviders};
use actix_web::rt::spawn;
use eyre::eyre;
use prometheus::process_provider_getter;

use crate::feeds::feeds_registry::Repeatability;
use crate::feeds::feeds_registry::Repeatability::Periodic;
use futures::stream::FuturesUnordered;
use paste::paste;
use prometheus::{inc_metric, inc_metric_by};
use std::fmt::Debug;
use std::time::Instant;
use tracing::info_span;
use tracing::{debug, error, info};

// Codegen from embedded Solidity code and precompiled bytecode.
// Price Feed Solidity Contract
sol! {
    #[allow(missing_docs)]
    // solc v0.8.24; solc a.sol --via-ir --optimize --bin
    #[sol(rpc, bytecode="0x60a060405234801561001057600080fd5b503360805260805160e761002d60003960006045015260e76000f3fe6080604052348015600f57600080fd5b506000366060600060046000601c37506000516201ffff811015604357600f60fc1b6020526005601c205460005260206000f35b7f0000000000000000000000000000000000000000000000000000000000000000338114606f57600080fd5b631a2d80ac8281109083101760ac57600f60fc1b6004523660045b8181101560aa57600481600037600560002060048201359055602401608a565b005b600080fdfea264697066735822122015800ed562cf954d8d71346ded5d44d9d6c459e49b37d67049ba43a5524b430764736f6c63430008180033")]
    contract DataFeedStoreV1 {
        function setFeeds(bytes calldata) external;
    }
}

// Sport Events Solidity Contract used for Oneshot metadata feeds
sol! {
    #[allow(missing_docs)]
    // solc v0.8.24; solc a.sol --via-ir --optimize --bin
    #[sol(rpc, bytecode="60a0604052348015600e575f80fd5b503373ffffffffffffffffffffffffffffffffffffffff1660808173ffffffffffffffffffffffffffffffffffffffff168152505060805161020e61005a5f395f60b1015261020e5ff3fe608060405234801561000f575f80fd5b5060045f601c375f5163800000008116156100ad5760043563800000001982166040517ff0000f000f00000000000000000000000000000000000000000000000000000081528160208201527ff0000f000f0000000000000001234000000000000000000000000000000000016040820152606081205f5b848110156100a5578082015460208202840152600181019050610087565b506020840282f35b505f7f000000000000000000000000000000000000000000000000000000000000000090503381146100dd575f80fd5b5f51631a2d80ac81036101d4576040513660045b818110156101d0577ff0000f000f0000000000000000000000000000000000000000000000000000008352600481603c8501377ff0000f000f000000000000000123400000000000000000000000000000000001604084015260608320600260048301607e86013760608401516006830192505f5b81811015610184576020810284013581840155600181019050610166565b50806020028301925060208360408701377fa826448a59c096f4c3cbad79d038bc4924494a46fc002d46861890ec5ac62df0604060208701a150506020810190506080830192506100f1565b5f80f35b5f80fdfea2646970667358221220b77f3ab2f01a4ba0833f1da56458253968f31db408e07a18abc96dd87a272d5964736f6c634300081a0033")]
    contract SportsDataFeedStoreV2 {
        function setFeeds(bytes calldata) external;
    }
}

pub async fn deploy_contract(
    network: &String,
    providers: &SharedRpcProviders,
    feed_type: Repeatability,
) -> Result<String> {
    let providers = providers
        .read()
        .expect("Could not lock all providers' lock");

    let provider = providers.get(network);
    let Some(p) = provider.cloned() else {
        return Err(eyre!("No provider for network {}", network));
    };
    drop(providers);
    let mut p = p.lock().await;
    let provider = &p.provider;

    // Get the base fee for the block.
    let base_fee = provider.get_gas_price().await?;

    // Deploy the contract.
    let contract_builder = if feed_type == Periodic {
        DataFeedStoreV1::deploy_builder(provider)
    } else {
        SportsDataFeedStoreV2::deploy_builder(provider)
    };
    let estimate = contract_builder.estimate_gas().await?;
    let deploy_time = Instant::now();
    let contract_address = contract_builder
        .gas(estimate)
        .gas_price(base_fee)
        .deploy()
        .await?;

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

    return Ok(format!(
        "CONTRACT_ADDRESS set to {}",
        contract_address.to_string()
    ));
}

pub async fn eth_batch_send_to_contract<
    K: Debug + Clone + std::string::ToString + 'static,
    V: Debug + Clone + std::string::ToString + 'static,
>(
    net: String,
    provider: Arc<Mutex<RpcProvider>>,
    updates: HashMap<K, V>,
    feed_type: Repeatability,
) -> Result<String> {
    let provider = provider.lock().await;
    let wallet = &provider.wallet;
    let contract_address = if feed_type == Periodic {
        provider
            .contract_address
            .expect(format!("Contract address not set for network {}.", net).as_str())
    } else {
        provider
            .event_contract_address
            .expect(format!("Event contract address not set for network {}.", net).as_str())
    };

    info!(
        "sending data to address `{}` in network `{}`",
        contract_address, net
    );

    let provider_metrics = &provider.provider_metrics;
    let provider = &provider.provider;

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
        .unwrap()
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
        .unwrap()
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

    let providers = providers
        .read()
        .expect("Error locking all providers mutex.");

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
                (Ok(x), net, _provider) => {
                    all_results += &format!("success from {} -> {:?}", net, x);
                }
                (Err(e), net, provider) => {
                    let err = format!(
                        "Timed out transaction for network {} -> {}",
                        net,
                        e.to_string()
                    );
                    error!(err);
                    all_results += &err;
                    let provider = provider.lock().await;
                    let provider_metrics = provider.provider_metrics.clone();
                    inc_metric!(provider_metrics, net, total_timed_out_tx);
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
    use crate::feeds::feed_slots_processor::feed_slots_processor_loop;
    use crate::feeds::feeds_registry::Repeatability::Oneshot;
    use crate::providers::provider::{can_read_contract_bytecode, init_shared_rpc_providers};
    use alloy::primitives::{address, Address};
    use alloy::{node_bindings::Anvil, providers::Provider};
    use regex::Regex;
    use sequencer_config::{
        get_test_config_with_multiple_providers, get_test_config_with_single_provider,
    };
    use std::collections::HashMap;
    use std::io::{self, Read};
    use std::str::FromStr;
    use std::time::UNIX_EPOCH;
    use std::{env, fs::File, io::Write};

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
        let key_path = "/tmp/priv_key_test";
        let network = "ETH131";
        let mut file = File::create(key_path).unwrap();
        file.write(b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356")
            .unwrap();

        let cfg =
            get_test_config_with_single_provider(network, key_path, anvil.endpoint().as_str());

        // give some time for cleanup env variables
        let providers = init_shared_rpc_providers(&cfg).await;

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
            let provider = providers.read().unwrap().get(network).unwrap().clone();
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
        let network = "ETH333";
        let mut file = File::create(key_path).unwrap();
        file.write(b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356")
            .unwrap();

        let cfg =
            get_test_config_with_single_provider(network, key_path, anvil.endpoint().as_str());

        let first_secret_key = anvil.keys().first().unwrap();
        let secret_key_bytes = first_secret_key.to_bytes();
        let providers = init_shared_rpc_providers(&cfg).await;

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

        let providers = providers
            .read()
            .expect("Could not lock all providers' lock");

        let provider = providers.get("ETH333").unwrap();

        // Updates for Oneshot
        let slot1 =
            String::from("0404040404040404040404040404040404040404040404040404040404040404");
        let slot2 =
            String::from("0505050505050505050505050505050505050505050505050505050505050505");
        let value1 = format!("{:04x}{}{}", 0x0002, slot1, slot2);
        let mut updates_oneshot: HashMap<String, String> = HashMap::new();
        updates_oneshot.insert(String::from("00000003"), value1);
        let result =
            eth_batch_send_to_contract(net.clone(), provider.clone(), updates_oneshot, Oneshot)
                .await;
        assert!(result.is_ok());
    }

    #[actix_web::test]
    async fn test_eth_batch_send_to_all_oneshot_contracts() {
        /////////////////////////////////////////////////////////////////////
        // BIG STEP ONE - Setup Anvil and deploy SportsDataFeedStoreV2 to it
        /////////////////////////////////////////////////////////////////////

        // setup
        let key_path = "/tmp/priv_key_test";
        let mut file = File::create(key_path).unwrap();
        file.write(b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356")
            .unwrap();
        let anvil_network1 = Anvil::new().try_spawn().unwrap();
        let network1 = "ETH374";
        let anvil_network2 = Anvil::new().try_spawn().unwrap();
        let network2 = "ETH375";

        let cfg = get_test_config_with_multiple_providers(vec![
            (network1, key_path, anvil_network1.endpoint().as_str()),
            (network2, key_path, anvil_network2.endpoint().as_str()),
        ]);

        let providers = init_shared_rpc_providers(&cfg).await;

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
