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
use eyre::Report;
use futures::stream::FuturesUnordered;
use std::fmt::Debug;

// Codegen from embedded Solidity code and precompiled bytecode.
sol! {
    #[allow(missing_docs)]
    // solc v0.8.24; solc a.sol --via-ir --optimize --bin
    #[sol(rpc, bytecode="0x60a060405234801561001057600080fd5b503360805260805160e761002d60003960006045015260e76000f3fe6080604052348015600f57600080fd5b506000366060600060046000601c37506000516201ffff811015604357600f60fc1b6020526005601c205460005260206000f35b7f0000000000000000000000000000000000000000000000000000000000000000338114606f57600080fd5b631a2d80ac8281109083101760ac57600f60fc1b6004523660045b8181101560aa57600481600037600560002060048201359055602401608a565b005b600080fdfea264697066735822122015800ed562cf954d8d71346ded5d44d9d6c459e49b37d67049ba43a5524b430764736f6c63430008180033")]
    contract DataFeedStoreV1 {
        function setFeeds(bytes calldata) external;
    }
}

pub async fn eth_send_to_contract(
    provider: Arc<Mutex<ProviderType>>,
    key: &str,
    val: &str,
) -> Result<String> {
    println!("eth_send_to_contract {} : {}", key, val);

    let mut updates = HashMap::new();
    updates.insert(key.to_string(), val.to_string());
    eth_batch_send_to_contract(provider, updates).await
}

pub async fn eth_batch_send_to_contract(
    provider: Arc<Mutex<ProviderType>>,
    updates: HashMap<String, String>,
) -> Result<String> {
    println!("eth_batch_send_to_contract updates: {:?}", updates);

    let collected_futures: FuturesUnordered<
        tokio::task::JoinHandle<std::prelude::v1::Result<String, Report>>,
    > = FuturesUnordered::new();

    collected_futures.push(spawn(async move {
        let wallet = get_wallet(); // Get the contract address.
        let contract_address = get_contract_address();
        println!("sending data to contract_address `{}`", contract_address);

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

        println!("tx =  {:?}", tx);

        let receipt = provider.send_transaction(tx).await?.get_receipt().await?;
        println!("Transaction receipt: {:?}", receipt);

        Ok(receipt.status().to_string())
    }));

    let result = futures::future::join_all(collected_futures).await;
    let mut all_results = String::new();
    for v in result {
        match v {
            Ok(res) => {
                all_results += &match res {
                    Ok(x) => x,
                    Err(e) => "ReportError:".to_owned() + &e.to_string(),
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
    println!("eth_batch_send_to_contract updates: {:?}", updates);

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

            println!("sending data to contract_address `{}`", contract_address);

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

            println!("tx =  {:?}", tx);

            let receipt = provider.send_transaction(tx).await?.get_receipt().await?;
            println!("Transaction receipt: {:?}", receipt);

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
                    Err(e) => "ReportError:".to_owned() + &e.to_string(),
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
