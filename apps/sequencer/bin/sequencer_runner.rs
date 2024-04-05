//! Example of deploying a contract from an artifact to Anvil and interacting with it.

use alloy::sol_types::SolCall;
use alloy::transports::http::Http;
use alloy::{
    hex::FromHex,
    network::{Ethereum, EthereumSigner, TransactionBuilder},
    node_bindings::Anvil,
    primitives::{address, Address, Bytes, U256},
    providers::{
        layers::{ManagedNonceProvider, NonceManagerLayer, SignerProvider},
        Provider, ProviderBuilder, ReqwestProvider, RootProvider,
    },
    rpc::{client::RpcClient, types::eth::BlockNumberOrTag, types::eth::TransactionRequest},
    signers::wallet::LocalWallet,
    sol,
};
use eyre::Result;
use reqwest::{Client, Url};

use std::{env::var, future::IntoFuture};

use threadpool::ThreadPool;
// use std::sync::mpsc::channel;
use once_cell::sync::Lazy;
use std::sync::{Arc, Mutex};

use actix_web::{error, Error};
use actix_web::{get, web, App, HttpServer};
use actix_web::{post, HttpResponse, Responder};
use futures::StreamExt;
use sequencer::utils::provider::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct MyObj {
    name: String,
    number: i32,
}

// Codegen from embedded Solidity code and precompiled bytecode.
sol! {
    #[allow(missing_docs)]
    // solc v0.8.24; solc a.sol --via-ir --optimize --bin
    #[sol(rpc, bytecode="0x60a0604052348015600f57600080fd5b503360805260805161010061002e6000396000604401526101006000f3fe6080604052348015600f57600080fd5b506000366060600060046000601c37506000516101ff811015604257600f60fc1b6020526005601c205460005260206000f35b7f0000000000000000000000000000000000000000000000000000000000000000338060206080a1508060206080a1600160206080a1338114608357600080fd5b631a2d80ac82161560bd57600f60fc1b6004523660045b8181101560ba57600481600037600560002060048201359055602401609a565b50505b5050915050805190602001f3fea26469706673582212207fdb309839c7e84be0656ff4c0d5e5077ea1de87b9b5ce493bc7e7e92f40b62164736f6c63430008190033")]
    contract DataFeedStoreV1 {
        function setFeeds(bytes calldata) external;
        event DebugCalled(uint _value);
        event DebugCalled1(bytes32 s);
    }
}

async fn deploy_contract() -> Result<()> {
    let provider = get_provider();
    let wallet = get_wallet();

    println!("Anvil running at `{:?}`", provider);

    // Get the base fee for the block.
    let base_fee = provider.get_gas_price().await?;

    let nonce: u64 = provider
        .get_transaction_count(wallet.address(), Some(BlockNumberOrTag::Latest.into()))
        .await
        .unwrap()
        .try_into()
        .unwrap();

    // Deploy the contract.
    let contract_builder = DataFeedStoreV1::deploy_builder(&provider);
    let estimate = contract_builder.estimate_gas().await?;
    let contract_address = contract_builder
        .gas(estimate)
        .gas_price(base_fee)
        .nonce(nonce)
        .deploy()
        .await?;

    println!("Deployed contract at address: {:?}", contract_address);

    Ok(())
}

async fn eth_send_to_contract_bad() -> Result<()> {
    println!("eth_send_to_contract");

    let signer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".parse()?;
    // Get the contract address.
    let contract_address = "0x5fbdb2315678afecb367f032d93f642f64180aa3"
        .parse()
        .expect("Contract address not found");
    println!("contract_address `{}`", contract_address);

    let provider = get_provider();
    let nonce: u64 = provider
        .get_transaction_count(signer, Some(BlockNumberOrTag::Latest.into()))
        .await
        .unwrap()
        .try_into()
        .unwrap();

    let input = Bytes::from_hex(
        "0x1a2d80ac0000000048656c6c6f2c20576f726c642120300000000000000000000000000000000000",
    )
    .unwrap();
    let tx = TransactionRequest::default()
        .to(Some(contract_address))
        .from(signer)
        .with_nonce(nonce)
        .with_gas_limit(U256::from(2e5))
        .with_max_fee_per_gas(U256::from(20e9))
        .with_max_priority_fee_per_gas(U256::from(1e9))
        .with_chain_id(31337)
        .input(Some(input).into());
    println!("tx =  {:?}", tx.input);

    println!("FAILED TX: {:?}", tx);

    let receipt = provider.send_transaction(tx).await?.get_receipt().await?;
    println!("Transaction receipt: {:?}", receipt);

    // key: 0x00000000
    let input = Bytes::from_hex("0x00000000").unwrap();
    let tx = TransactionRequest::default()
        .to(Some(contract_address))
        .from(signer)
        .with_gas_limit(U256::from(21000))
        .with_max_fee_per_gas(U256::from(20e9))
        .with_max_priority_fee_per_gas(U256::from(1e9))
        .with_chain_id(31337)
        .input(Some(input).into());

    let result = provider.call(&tx, None).await?;
    println!("Call result: {:?}", result);

    Ok(())
}

async fn eth_send_to_contract() -> Result<()> {
    println!("eth_send_to_contract");

    let wallet = get_wallet(); // Get the contract address.
    let contract_address = "0x5fbdb2315678afecb367f032d93f642f64180aa3"
        .parse()
        .expect("Contract address not found");
    println!("contract_address `{}`", contract_address);

    let provider = get_provider();
    let nonce: u64 = provider
        .get_transaction_count(wallet.address(), Some(BlockNumberOrTag::Latest.into()))
        .await
        .unwrap()
        .try_into()
        .unwrap();

    let input = Bytes::from_hex(
        "0x1a2d80ac0000000048656c6c6f2c20576f726c642120300000000000000000000000000000000000",
        //"0000000048656c6c6f2c20576f726c642120300000000000000000000000000000000000"
    )
    .unwrap();

    let contract = DataFeedStoreV1::new(contract_address, &provider);

    let base_fee = provider.get_gas_price().await?;

    // let estimate = contract.setFeeds(input.clone()).estimate_gas().await?;
    //let builder = contract.setFeeds(input.clone()).from(wallet.address()).nonce(nonce).gas(estimate).gas_price(base_fee);
    //let receipt = builder.send().await?.get_receipt().await?;

    let tx = TransactionRequest::default()
        .to(Some(contract_address))
        .from(wallet.address())
        .with_nonce(nonce)
        .with_gas_limit(U256::from(2e5))
        .with_max_fee_per_gas(base_fee + base_fee)
        .with_max_priority_fee_per_gas(U256::from(1e9))
        .with_chain_id(31337)
        .input(Some(input).into());
    println!("tx =  {:?}", tx.input);

    println!("FAILED TX: {:?}", tx);

    let receipt = provider.send_transaction(tx).await?.get_receipt().await?;
    println!("Transaction receipt: {:?}", receipt);

    //    println!("receipt: {:?}", receipt);

    Ok(())
}

#[get("/")]
async fn index() -> impl Responder {
    println!("Executed job");
    let _var = deploy_contract().await.unwrap();

    "Hello, World!"
}

#[get("/{name}")]
async fn hello(name: web::Path<String>) -> impl Responder {
    let _var = eth_send_to_contract().await.unwrap();
    format!("Hello {}!", &name)
}

const MAX_SIZE: usize = 262_144; // max payload size is 256k

#[post("/{name}")]
async fn index_post(
    name: web::Path<String>,
    mut payload: web::Payload,
) -> Result<HttpResponse, Error> {
    // payload is a stream of Bytes objects
    println!("Called index_post {}!", name);
    let mut body = web::BytesMut::new();
    while let Some(chunk) = payload.next().await {
        let chunk = chunk?;
        // limit max size of in-memory payload
        if (body.len() + chunk.len()) > MAX_SIZE {
            return Err(error::ErrorBadRequest("overflow"));
        }
        body.extend_from_slice(&chunk);
    }

    // body is loaded, now we can deserialize serde-json
    // let obj = serde_json::from_slice::<MyObj>(&body)?;
    println!("body = {:?}!", body);
    Ok(HttpResponse::Ok().into()) // <- send response
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let _init_provider = get_provider();
    HttpServer::new(|| App::new().service(index).service(hello).service(index_post))
        .bind(("0.0.0.0", 8877))?
        .run()
        .await
}
