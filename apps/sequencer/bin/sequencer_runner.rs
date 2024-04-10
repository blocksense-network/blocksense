//! Example of deploying a contract from an artifact to Anvil and interacting with it.

use alloy::{
    hex::FromHex,
    network::TransactionBuilder,
    primitives::{Bytes, U256},
    providers::Provider,
    rpc::{types::eth::BlockNumberOrTag, types::eth::TransactionRequest},
    sol,
};
use eyre::Result;
use std::env;

use actix_web::{error, rt::spawn, rt::time, Error};
use actix_web::{get, web, App, HttpServer};
use actix_web::{post, HttpResponse, Responder};
use futures::StreamExt;
use sequencer::utils::byte_utils::*;
use sequencer::utils::provider::*;
use serde::{Deserialize, Serialize};
use tokio::time::Duration;

#[derive(Serialize, Deserialize)]
struct MyObj {
    name: String,
    number: i32,
}

// Codegen from embedded Solidity code and precompiled bytecode.
sol! {
    #[allow(missing_docs)]
    // solc v0.8.24; solc a.sol --via-ir --optimize --bin
    #[sol(rpc, bytecode="0x60a060405234801561001057600080fd5b503360805260805160e761002d60003960006045015260e76000f3fe6080604052348015600f57600080fd5b506000366060600060046000601c37506000516201ffff811015604357600f60fc1b6020526005601c205460005260206000f35b7f0000000000000000000000000000000000000000000000000000000000000000338114606f57600080fd5b631a2d80ac8281109083101760ac57600f60fc1b6004523660045b8181101560aa57600481600037600560002060048201359055602401608a565b005b600080fdfea264697066735822122015800ed562cf954d8d71346ded5d44d9d6c459e49b37d67049ba43a5524b430764736f6c63430008180033")]
    contract DataFeedStoreV1 {
        function setFeeds(bytes calldata) external;
    }
}

async fn deploy_contract() -> Result<String> {
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

    println!(
        "Deployed contract at address: {:?}\n",
        contract_address.to_string()
    );

    env::set_var("CONTRACT_ADDRESS", contract_address.to_string());

    Ok(format!(
        "CONTRACT_ADDRESS set to {}",
        contract_address.to_string()
    ))
}

async fn eth_send_to_contract(key: &str, val: &str) -> Result<String> {
    println!("eth_send_to_contract");

    let wallet = get_wallet(); // Get the contract address.
    let contract_address = get_contract_address();
    println!("sending data to contract_address `{}`", contract_address);

    let provider = get_provider();
    let nonce: u64 = provider
        .get_transaction_count(wallet.address(), Some(BlockNumberOrTag::Latest.into()))
        .await
        .unwrap()
        .try_into()
        .unwrap();

    let selector = "0x1a2d80ac";

    let input = Bytes::from_hex((selector.to_owned() + key + val).as_str()).unwrap();

    let base_fee = provider.get_gas_price().await?;
    let max_priority_fee_per_gas = provider.get_max_priority_fee_per_gas().await?;

    // let contract = DataFeedStoreV1::new(contract_address, &provider);
    // let estimate = contract.setFeeds(input.clone()).from(wallet.address()).estimate_gas().await?;
    // let builder = contract.setFeeds(input.clone()).from(wallet.address()).nonce(nonce).gas(estimate).gas_price(base_fee);
    // let receipt = builder.send().await?.get_receipt().await?;

    let tx = TransactionRequest::default()
        .to(Some(contract_address))
        .from(wallet.address())
        .with_nonce(nonce)
        .with_gas_limit(U256::from(2e5))
        .with_max_fee_per_gas(base_fee + base_fee)
        .with_max_priority_fee_per_gas(max_priority_fee_per_gas)
        .with_chain_id(provider.get_chain_id().await?.to())
        .input(Some(input).into());

    println!("tx =  {:?}", tx);

    let receipt = provider.send_transaction(tx).await?.get_receipt().await?;
    println!("Transaction receipt: {:?}", receipt);

    Ok(receipt.status().to_string())
}

async fn get_key_from_contract() -> Result<String> {
    println!("eth_send_to_contract");

    let wallet = get_wallet(); // Get the contract address.
    let contract_address = get_contract_address();
    println!("sending data to contract_address `{}`", contract_address);

    let provider = get_provider();

    let base_fee = provider.get_gas_price().await?;

    // key: 0x00000000
    let input = Bytes::from_hex("0x00000000").unwrap();
    let tx = TransactionRequest::default()
        .to(Some(contract_address))
        .from(wallet.address())
        .with_gas_limit(U256::from(2e5))
        .with_max_fee_per_gas(base_fee + base_fee)
        .with_max_priority_fee_per_gas(U256::from(1e9))
        .with_chain_id(provider.get_chain_id().await?.to())
        .input(Some(input).into());

    let result = provider.call(&tx, None).await?;
    println!("Call result: {:?}", result);

    Ok(result.to_string())
}

#[get("/deploy")]
async fn index() -> impl Responder {
    println!("Deploying ...");
    let _var = deploy_contract().await.unwrap();

    "Hello, World!"
}

#[get("/get_key")]
async fn get_key() -> impl Responder {
    println!("getting key ...");
    get_key_from_contract().await.unwrap()
}

#[get("/{name}")]
async fn hello(name: web::Path<String>) -> impl Responder {
    format!(
        "{} {}",
        name,
        eth_send_to_contract(
            "00000000",
            "48656c6c6f2c20576f726c642120300000000000000000000000000000000000"
        )
        .await
        .unwrap()
    )
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

    let v: serde_json::Value = serde_json::from_str(std::str::from_utf8(&body).unwrap())?;
    let mut result_bytes = v["result"]
        .to_string()
        .parse::<f32>()
        .unwrap()
        .to_be_bytes()
        .to_vec();
    result_bytes.resize(32, 0);
    let result_hex = to_hex_string(result_bytes);

    eth_send_to_contract("00000000", result_hex.as_str())
        .await
        .unwrap();

    Ok(HttpResponse::Ok().into()) // <- send response
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    spawn(async move {
        let mut interval = time::interval(Duration::from_secs(10));
        loop {
            interval.tick().await;
            println!("Tick.");
        }
    });

    let _init_provider = get_provider();
    HttpServer::new(|| {
        App::new()
            .service(get_key)
            .service(index)
            .service(hello)
            .service(index_post)
    })
    .bind(("0.0.0.0", 8877))?
    .run()
    .await
}
