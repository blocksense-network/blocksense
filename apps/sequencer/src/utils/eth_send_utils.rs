use alloy::{
    hex::FromHex, network::TransactionBuilder, primitives::Bytes, providers::Provider,
    rpc::types::eth::TransactionRequest, sol,
};
use eyre::Result;
// use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::utils::provider::{
    get_contract_address, get_wallet, ProviderType, RpcProvider, SharedRpcProviders,
};
use actix_web::rt::spawn;
use eyre::eyre;
use eyre::Report;
use futures::stream::FuturesUnordered;
use std::fmt::Debug;
use std::time::Instant;
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
    if let Some(p) = provider.cloned() {
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
    Err(eyre!("No provider for network {}", network))
}

pub async fn eth_send_to_contract(
    provider: Arc<Mutex<ProviderType>>,
    key: &str,
    val: &str,
) -> Result<String> {
    debug!("eth_send_to_contract {} : {}", key, val);

    let mut updates = HashMap::new();
    updates.insert(key.to_string(), val.to_string());
    eth_batch_send_to_contract(provider, updates).await
}

pub async fn eth_batch_send_to_contract(
    provider: Arc<Mutex<ProviderType>>,
    updates: HashMap<String, String>,
) -> Result<String> {
    debug!("eth_batch_send_to_contract updates: {:?}", updates);

    let collected_futures: FuturesUnordered<
        tokio::task::JoinHandle<std::prelude::v1::Result<String, Report>>,
    > = FuturesUnordered::new();

    collected_futures.push(spawn(async move {
        let wallet = get_wallet(); // Get the contract address.
        let contract_address = get_contract_address();
        info!("sending data to contract_address `{}`", contract_address);

        let provider = provider.lock().await;

        let selector = "0x1a2d80ac";

        let mut keys_vals: String = Default::default();

        for (key, val) in updates.into_iter() {
            keys_vals += &key;
            keys_vals += &val;
        }

        let input = Bytes::from_hex((selector.to_owned() + keys_vals.as_str()).as_str()).unwrap();

        let base_fee = provider.get_gas_price().await?;
        let max_priority_fee_per_gas = provider.get_max_priority_fee_per_gas().await?;

        let tx = TransactionRequest::default()
            .to(contract_address)
            .from(wallet.address())
            .with_gas_limit(2e5 as u128)
            .with_max_fee_per_gas(base_fee + base_fee)
            .with_max_priority_fee_per_gas(max_priority_fee_per_gas)
            .with_chain_id(provider.get_chain_id().await?)
            .input(Some(input).into());

        info!("tx =  {:?}", tx);

        let receipt = provider.send_transaction(tx).await?.get_receipt().await?;
        info!("Transaction receipt: {:?}", receipt);

        Ok(receipt.status().to_string())
    }));

    let result = futures::future::join_all(collected_futures).await;
    let mut all_results = String::new();
    for v in result {
        match v {
            Ok(res) => {
                all_results += &match res {
                    Ok(x) => x,
                    Err(e) => {
                        let err = "ReportError:".to_owned() + &e.to_string();
                        error!(err);
                        err
                    }
                }
            }
            Err(e) => {
                all_results += "JoinError:";
                all_results += &e.to_string()
            }
        }
        all_results += " "
    }
    Ok(all_results)
}

pub async fn eth_batch_send_to_all_contracts<
    K: Debug + Clone + std::string::ToString + 'static,
    V: Debug + Clone + std::string::ToString + 'static,
>(
    providers: SharedRpcProviders,
    updates: HashMap<K, V>,
) -> Result<String> {
    debug!("eth_batch_send_to_contract updates: {:?}", updates);

    let providers = providers
        .read()
        .expect("Error locking all providers mutex.");

    let collected_futures: FuturesUnordered<
        tokio::task::JoinHandle<std::prelude::v1::Result<String, Report>>,
    > = FuturesUnordered::new();

    for (net, p) in
        <HashMap<std::string::String, Arc<tokio::sync::Mutex<RpcProvider>>> as Clone>::clone(
            &providers,
        )
        .into_iter()
    {
        let updates = updates.clone();
        let provider = p.clone();
        collected_futures.push(spawn(async move {
            let provider = provider.lock().await;
            let wallet = &provider.wallet;
            let contract_address = provider
                .contract_address
                .expect(format!("Contract address not set for network {}.", net).as_str());

            info!(
                "sending data to contract_address `{}` in network `{}`",
                contract_address, net
            );

            let provider = &provider.provider;

            let selector = "0x1a2d80ac";

            let mut keys_vals: String = Default::default();

            for (key, val) in updates.into_iter() {
                keys_vals += &key.to_string();
                keys_vals += &val.to_string();
            }

            let input =
                Bytes::from_hex((selector.to_owned() + keys_vals.as_str()).as_str()).unwrap();

            let base_fee = provider.get_gas_price().await?;
            let max_priority_fee_per_gas = provider.get_max_priority_fee_per_gas().await?;

            let tx = TransactionRequest::default()
                .to(contract_address)
                .from(wallet.address())
                .with_gas_limit(2e5 as u128)
                .with_max_fee_per_gas(base_fee + base_fee)
                .with_max_priority_fee_per_gas(max_priority_fee_per_gas)
                .with_chain_id(provider.get_chain_id().await?)
                .input(Some(input).into());

            info!("Sending to `{}` tx =  {:?}", net, tx);
            let tx_time = Instant::now();

            let receipt = provider.send_transaction(tx).await?.get_receipt().await?;
            info!(
                "Recvd transaction receipt that took {}ms from `{}`: {:?}",
                tx_time.elapsed().as_millis(),
                net,
                receipt
            );

            Ok(receipt.status().to_string())
        }));
    }

    drop(providers);

    let result = futures::future::join_all(collected_futures).await;
    let mut all_results = String::new();
    for v in result {
        match v {
            Ok(res) => {
                all_results += &match res {
                    Ok(x) => x,
                    Err(e) => {
                        let err = "ReportError:".to_owned() + &e.to_string();
                        error!(err);
                        err
                    }
                }
            }
            Err(e) => {
                all_results += "JoinError:";
                all_results += &e.to_string()
            }
        }
        all_results += " "
    }
    Ok(all_results)
}
