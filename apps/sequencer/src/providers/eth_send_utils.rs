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

use crate::process_provider_getter;
use crate::providers::provider::{RpcProvider, SharedRpcProviders};
use actix_web::rt::spawn;
use eyre::eyre;

use futures::stream::FuturesUnordered;
use paste::paste;
use std::fmt::Debug;
use std::time::Instant;
use tracing::info_span;
use tracing::{debug, error, info};

// Codegen from embedded Solidity code and precompiled bytecode.
sol! {
    #[allow(missing_docs)]
    // solc v0.8.24; solc a.sol --via-ir --optimize --bin
    #[sol(rpc, bytecode="0x60a060405234801561001057600080fd5b503360805260805160e761002d60003960006045015260e76000f3fe6080604052348015600f57600080fd5b506000366060600060046000601c37506000516201ffff811015604357600f60fc1b6020526005601c205460005260206000f35b7f0000000000000000000000000000000000000000000000000000000000000000338114606f57600080fd5b631a2d80ac8281109083101760ac57600f60fc1b6004523660045b8181101560aa57600481600037600560002060048201359055602401608a565b005b600080fdfea264697066735822122015800ed562cf954d8d71346ded5d44d9d6c459e49b37d67049ba43a5524b430764736f6c63430008180033")]
    contract DataFeedStoreV1 {
        function setFeeds(bytes calldata) external;
    }
}

pub async fn deploy_contract(network: &String, providers: &SharedRpcProviders) -> Result<String> {
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
    let contract_builder = DataFeedStoreV1::deploy_builder(provider);
    let estimate = contract_builder.estimate_gas().await?;
    let deploy_time = Instant::now();
    let contract_address = contract_builder
        .gas(estimate)
        .gas_price(base_fee)
        .deploy()
        .await?;

    info!(
        "Deployed contract at address: {:?} took {}ms\n",
        contract_address.to_string(),
        deploy_time.elapsed().as_millis()
    );

    p.contract_address = Some(contract_address);

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
) -> Result<String> {
    let provider = provider.lock().await;
    let wallet = &provider.wallet;
    let contract_address = provider
        .contract_address
        .expect(format!("Contract address not set for network {}.", net).as_str());

    info!(
        "sending data to contract_address `{}` in network `{}`",
        contract_address, net
    );

    let provider_metrix = &provider.provider_metrics;
    let provider = &provider.provider;

    let selector = "0x1a2d80ac";

    let mut keys_vals: String = Default::default();

    for (key, val) in updates.into_iter() {
        keys_vals += key.to_string().as_str();
        keys_vals += val.to_string().as_str();
    }

    let input = match Bytes::from_hex((selector.to_owned() + keys_vals.as_str()).as_str()) {
        Err(e) => panic!("Key is not valid hex string: {}", e), // We panic here, because the http handler on the recv side must filter out wrong input.
        Ok(x) => x,
    };

    let base_fee = process_provider_getter!(
        provider.get_gas_price().await,
        provider_metrix,
        get_gas_price
    );

    debug!("Observed gas price (base_fee) = {}", base_fee);
    provider_metrix
        .gas_price
        .observe((base_fee as f64) / 1000000000.0);

    let max_priority_fee_per_gas = process_provider_getter!(
        provider.get_max_priority_fee_per_gas().await,
        provider_metrix,
        get_max_priority_fee_per_gas
    );

    let chain_id =
        process_provider_getter!(provider.get_chain_id().await, provider_metrix, get_chain_id);

    let tx = TransactionRequest::default()
        .to(contract_address)
        .from(wallet.address())
        .with_gas_limit(2e5 as u128)
        .with_max_fee_per_gas(base_fee + base_fee)
        .with_max_priority_fee_per_gas(max_priority_fee_per_gas)
        .with_chain_id(chain_id)
        .input(Some(input).into());

    info!("Sending to `{}` tx =  {:?}", net, tx);
    let tx_time = Instant::now();

    let receipt_future = process_provider_getter!(
        provider.send_transaction(tx).await,
        provider_metrix,
        send_tx
    );

    let receipt = process_provider_getter!(
        receipt_future.get_receipt().await,
        provider_metrix,
        get_receipt
    );

    let transaction_time = tx_time.elapsed().as_millis();
    info!(
        "Recvd transaction receipt that took {}ms from `{}`: {:?}",
        transaction_time, net, receipt
    );
    provider_metrix.total_tx_sent.inc();
    provider_metrix.gas_used.inc_by(receipt.gas_used as u64);
    provider_metrix
        .effective_gas_price
        .inc_by(receipt.effective_gas_price as u64);
    provider_metrix
        .transaction_confirmation_times
        .observe(transaction_time as f64);
    Ok(receipt.status().to_string())
}

pub async fn eth_batch_send_to_all_contracts<
    K: Debug + Clone + std::string::ToString + 'static,
    V: Debug + Clone + std::string::ToString + 'static,
>(
    providers: SharedRpcProviders,
    updates: HashMap<K, V>,
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
                eth_batch_send_to_contract(net.clone(), p.clone(), updates),
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
                    provider.provider_metrics.total_timed_out_tx.inc();
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
    use crate::providers::provider::init_shared_rpc_providers;
    use alloy::{node_bindings::Anvil, providers::Provider};
    use regex::Regex;
    use std::{env, fs::File, io::Write};

    fn extract_address(message: &str) -> Option<String> {
        let re = Regex::new(r"0x[a-fA-F0-9]{40}").expect("Invalid regex");
        if let Some(mat) = re.find(message) {
            return Some(mat.as_str().to_string());
        }
        None
    }

    use sequencer_config::get_test_config_with_single_provider;

    #[tokio::test]
    async fn test_deploy_contract_returns_valid_address() {
        // setup
        // let target_deploy_address = generate_random_eth_address();
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
        let result = deploy_contract(&String::from(network), &providers).await;
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
    }
}
