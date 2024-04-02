//! Example of deploying a contract from an artifact to Anvil and interacting with it.

use alloy::sol_types::SolCall;
use alloy::{
    hex::FromHex,
    network::{Ethereum, EthereumSigner},
    node_bindings::Anvil,
    primitives::{Bytes, U256},
    providers::{Provider, ReqwestProvider},
    rpc::{client::RpcClient, types::eth::TransactionRequest},
    signers::wallet::LocalWallet,
    sol,
};
use eyre::Result;

use threadpool::ThreadPool;
// use std::sync::mpsc::channel;
use once_cell::sync::Lazy;

static THREAD_POOL: Lazy<ThreadPool> = Lazy::new(|| ThreadPool::new(num_cpus::get()));

use actix_web::{error, Error};
use actix_web::{get, web, App, HttpServer};
use actix_web::{post, HttpResponse, Responder};
use futures::StreamExt;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct MyObj {
    name: String,
    number: i32,
}

// Codegen from artifact.
sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    DataFeedStoreV1_proxy,
    r#"[
        {
          "inputs": [
            {
              "internalType": "bytes",
              "name": "",
              "type": "bytes"
            }
          ],
          "name": "setFeeds",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ]"#
);

sol!(
    #[allow(missing_docs)]
    function setFeeds(bytes calldata) external;
);

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    DataFeedStoreV1,
    "src/artifacts/contracts/DataFeedStoreV1.sol/DataFeedStoreV1.json"
);

#[tokio::main]
async fn eth_test() -> Result<()> {
    // Spin up a local Anvil node.
    // Ensure `anvil` is available in $PATH.
    let anvil = Anvil::new().try_spawn()?;

    // Set up signer from the first default Anvil account (Alice).
    // let signer: LocalWallet = anvil.keys()[0].clone().into();

    // Create a provider with a signer.
    let rpc_url = anvil.endpoint().parse()?;

    // Create the RPC client.
    let rpc_client = RpcClient::new_http(rpc_url);

    // Provider can then be instantiated using the RPC client, ReqwestProvider is an alias
    // RootProvider. RootProvider requires two generics N: Network and T: Transport
    let provider = ReqwestProvider::<Ethereum>::new(rpc_client);

    println!("Anvil running at `{}`", anvil.endpoint());

    // Get the base fee for the block.
    // let base_fee = provider.get_gas_price().await?;

    let bytecode = DataFeedStoreV1::BYTECODE.to_owned();
    let signer = anvil.addresses()[0];
    // Create a transaction.
    let tx = TransactionRequest {
        from: Some(signer),
        input: Some(bytecode).into(),
        to: None,
        // nonce: Some(1),
        ..Default::default()
    };

    // Send the transaction and wait for the receipt.
    let receipt = provider.send_transaction(tx).await?.get_receipt().await?;

    // Get the contract address.
    let contract_address = receipt
        .contract_address
        .expect("Contract address not found");
    println!("contract_address `{}`", contract_address);

    // let contract = DataFeedStoreV1_proxy::new(contract_address, &provider);

    // let estimate = contract.setNumber(U256::from(42)).estimate_gas().await?;
    // let builder = contract.setNumber(U256::from(42)).nonce(1).gas(estimate).gas_price(base_fee);
    // let receipt = builder.send().await?.get_receipt().await?;

    // let estimate = contract.setFeeds(Bytes::from(vec![1,2,3,4,5])).estimate_gas().await?;
    // let res = contract.setFeeds(Bytes::from(vec![1,2,3,4,5])).nonce(0).gas(estimate).gas_price(base_fee).send().await?.get_receipt().await?;

    //let call = setFeedsCall {_0:Bytes::from(vec![1,2,3,4,5,6])}.abi_encode();
    // selector: 0x1a2d80ac
    // key: 0x00000000
    // value: 0x48656c6c6f2c20576f726c642120300000000000000000000000000000000000
    let input = Bytes::from_hex(
        "0x1a2d80ac0000000048656c6c6f2c20576f726c642120300000000000000000000000000000000000",
    )
    .unwrap();
    let tx = TransactionRequest::default()
        .to(Some(contract_address))
        .from(signer)
        .input(Some(input).into());
    println!("tx =  {:?}", tx.input);

    let receipt = provider.send_transaction(tx).await?.get_receipt().await?;
    println!("Set number to 42: {:?}", receipt);

    // key: 0x00000000
    let input = Bytes::from_hex("0x00000000").unwrap();
    let tx = TransactionRequest::default()
        .to(Some(contract_address))
        .from(signer)
        .input(Some(input).into());
    let result = provider.call(&tx, None).await?;
    println!("Set number to 42: {:?}", result);

    Ok(())
}

#[get("/")]
async fn index() -> impl Responder {
    THREAD_POOL.execute(move || {
        println!("Executed job");
        let _var = eth_test().unwrap();
    });

    "Hello, World!"
}

#[get("/{name}")]
async fn hello(name: web::Path<String>) -> impl Responder {
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
    HttpServer::new(|| App::new().service(index).service(hello).service(index_post))
        .bind(("0.0.0.0", 8877))?
        .run()
        .await
}
