//! Example of deploying a contract from an artifact to Anvil and interacting with it.

use alloy::providers::Identity;
use alloy::transports::http::Http;
use alloy::{
    hex::FromHex,
    network::{Ethereum, EthereumSigner, TransactionBuilder},
    primitives::Bytes,
    providers::{
        fillers::{ChainIdFiller, FillProvider, GasFiller, JoinFill, NonceFiller, SignerFiller},
        Provider, RootProvider,
    },
    rpc::types::eth::TransactionRequest,
    sol,
};
use reqwest::Client;

use eyre::Result;
use std::sync::{Arc, RwLock};
use std::{env, ops::DerefMut};

use sequencer::feeds::feeds_registry::{
    get_feed_id, new_feeds_meta_data_reg_with_test_data, AllFeedsReports, FeedMetaData,
    FeedMetaDataRegistry,
};

use actix_web::{error, rt::spawn, rt::time, Error};
use actix_web::{get, web, App, HttpServer};
use actix_web::{post, HttpResponse, Responder};
use futures::StreamExt;
use sequencer::utils::byte_utils::to_hex_string;
use sequencer::utils::provider::*;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::time::Duration;

#[derive(Serialize, Deserialize)]
struct MyObj {
    name: String,
    number: i32,
}

use once_cell::sync::Lazy;
use tokio::sync::Mutex;
static PROVIDER: Lazy<
    Arc<
        Mutex<
            FillProvider<
                JoinFill<
                    JoinFill<JoinFill<JoinFill<Identity, GasFiller>, NonceFiller>, ChainIdFiller>,
                    SignerFiller<EthereumSigner>,
                >,
                RootProvider<Http<Client>>,
                Http<Client>,
                Ethereum,
            >,
        >,
    >,
> = Lazy::new(|| get_shared_provider());
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
    let mut provider = PROVIDER.lock().await;

    println!("Anvil running at `{:?}`", provider);

    // Get the base fee for the block.
    let base_fee = provider.get_gas_price().await?;

    // let nonce: u64 = provider
    //     .get_transaction_count(wallet.address(), BlockNumberOrTag::Latest.into())
    //     .await
    //     .unwrap()
    //     .try_into()
    //     .unwrap();

    // Deploy the contract.
    let contract_builder = DataFeedStoreV1::deploy_builder(provider.deref_mut());
    let estimate = contract_builder.estimate_gas().await?;
    let contract_address = contract_builder
        .gas(estimate)
        .gas_price(base_fee)
        // .nonce(nonce)
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
    println!("eth_send_to_contract {} : {}", key, val);

    let wallet = get_wallet(); // Get the contract address.
    let contract_address = get_contract_address();
    println!("sending data to contract_address `{}`", contract_address);

    let provider = PROVIDER.lock().await;
    // let nonce: u64 = provider
    //     .get_transaction_count(wallet.address(), BlockNumberOrTag::Latest.into())
    //     .await
    //     .unwrap()
    //     .try_into()
    //     .unwrap();

    let selector = "0x1a2d80ac";

    let input = Bytes::from_hex((selector.to_owned() + key + val).as_str()).unwrap();

    let base_fee = provider.get_gas_price().await?;
    let max_priority_fee_per_gas = provider.get_max_priority_fee_per_gas().await?;

    // let contract = DataFeedStoreV1::new(contract_address, &provider);
    // let estimate = contract.setFeeds(input.clone()).from(wallet.address()).estimate_gas().await?;
    // let builder = contract.setFeeds(input.clone()).from(wallet.address()).nonce(nonce).gas(estimate).gas_price(base_fee);
    // let receipt = builder.send().await?.get_receipt().await?;

    let tx = TransactionRequest::default()
        .to(contract_address)
        .from(wallet.address())
        // .with_nonce(nonce)
        .with_gas_limit(2e5 as u128)
        .with_max_fee_per_gas(base_fee + base_fee)
        .with_max_priority_fee_per_gas(max_priority_fee_per_gas)
        .with_chain_id(provider.get_chain_id().await?)
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

    let provider = PROVIDER.lock().await;

    let base_fee = provider.get_gas_price().await?;

    // key: 0x00000000
    let input = Bytes::from_hex("0x00000000").unwrap();
    let tx = TransactionRequest::default()
        .to(contract_address)
        .from(wallet.address())
        .with_gas_limit(2e5 as u128)
        .with_max_fee_per_gas(base_fee + base_fee)
        .with_max_priority_fee_per_gas(1e9 as u128)
        .with_chain_id(provider.get_chain_id().await?)
        .input(Some(input).into());

    let result = provider.call(&tx).await?;
    println!("Call result: {:?}", result);

    Ok(result.to_string())
}

#[get("/deploy")]
async fn index() -> impl Responder {
    println!("Deploying ...");
    deploy_contract().await.unwrap()
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
    app_state: web::Data<AppState>,
) -> Result<HttpResponse, Error> {
    println!("Called index_post {}", name);
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

    let report_hex_syze = 64;

    let v: serde_json::Value = serde_json::from_str(std::str::from_utf8(&body)?)?;
    let result_hex = match v["result"].to_string().parse::<f32>() {
        Ok(x) => {
            let mut res = x.to_be_bytes().to_vec();
            res.resize(report_hex_syze, 0);
            to_hex_string(res)
        }
        Err(_) => {
            let value = v["result"].to_string();
            if value.len() != report_hex_syze
                || !value
                    .chars()
                    .all(|arg0: char| char::is_ascii_hexdigit(&arg0))
            {
                return Ok(HttpResponse::BadRequest().into());
            }
            value
        }
    };

    let feed_id = get_feed_id(v["feed_id"].to_string().as_str());

    let reporter_id = match v["reporter_id"].to_string().parse::<u64>() {
        Ok(x) => x,
        Err(_) => {
            return Ok(HttpResponse::BadRequest().into());
        }
    };

    let msg_timestamp = match v["timestamp"].to_string().parse::<u128>() {
        Ok(x) => x,
        Err(_) => {
            return Ok(HttpResponse::BadRequest().into());
        }
    };

    // println!("result = {:?}; feed_id = {:?}; reporter_id = {:?}", result_bytes, feed_id, reporter_id);
    let feed;
    {
        let reg = app_state
            .registry
            .read()
            .expect("Error trying to lock Registry for read!");
        println!("getting feed_id = {}", &feed_id);
        feed = match reg.get(feed_id.into()) {
            Some(x) => x,
            None => return Ok(HttpResponse::BadRequest().into()),
        };
    }

    let current_time_as_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis();

    // check if the time stamp in the msg is <= current_time_as_ms
    // and check if it is inside the current active slot frame.
    let accept_report = {
        let feed = feed.read().expect("Error trying to lock Feed for read!");
        feed.check_report_relevance(current_time_as_ms, msg_timestamp)
    };

    if accept_report {
        let mut reports = app_state
            .reports
            .write()
            .expect("Error trying to lock Reports for read!");
        reports.push(feed_id.into(), reporter_id, result_hex);
        return Ok(HttpResponse::Ok().into()); // <- send response
    }
    Ok(HttpResponse::BadRequest().into())
}

struct AppState {
    registry: Arc<RwLock<FeedMetaDataRegistry>>,
    reports: Arc<RwLock<AllFeedsReports>>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let app_state = web::Data::new(AppState {
        registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_with_test_data())),
        reports: Arc::new(RwLock::new(AllFeedsReports::new())),
    });

    {
        let reg = app_state.registry.write().unwrap();
        let keys = reg.get_keys();
        for key in keys {
            let feed = reg.get(key).unwrap();
            let feed = feed.read().unwrap();
            let name = feed.get_name().clone();
            let report_interval = feed.get_report_interval();
            let first_report_start_time = feed.get_first_report_start_time_ms();

            println!("key = {} : value = {:?}", key, reg.get(key));

            let app_state_clone: web::Data<AppState> = app_state.clone(); //This will be moved into the spawned timer below

            spawn(async move {
                let mut interval = time::interval(Duration::from_millis(report_interval));
                interval.tick().await; // The first tick completes immediately.
                loop {
                    interval.tick().await;

                    let result_post_to_contract: String;
                    let key_post: u64;
                    {
                        let feed: Arc<RwLock<FeedMetaData>>;
                        {
                            let reg = app_state_clone.registry.write().unwrap();
                            feed = match reg.get(key) {
                                Some(x) => x,
                                None => panic!("Error timer for feed that was not registered."),
                            };
                        }
                        let slot = feed.read().unwrap().get_slot();
                        println!("processing votes for feed_id = {}, slot = {}", &key, &slot);

                        println!(
                            "Tick from {} with id {} rep_interval {}.",
                            name, key, report_interval
                        );

                        let reports = match app_state_clone.reports.read().unwrap().get(key) {
                            Some(x) => x,
                            None => {
                                println!("No reports found!");
                                feed.write().unwrap().inc_slot();
                                continue;
                            }
                        };
                        println!("found the following reports:");
                        println!("reports = {:?}", reports);

                        let mut reports = reports.write().unwrap();
                        // Process the reports:
                        let mut values: Vec<&String> = vec![];
                        for kv in &reports.report {
                            values.push(&kv.1);
                        }

                        if values.is_empty() {
                            println!("No reports found for slot {}!", &slot);
                            feed.write().unwrap().inc_slot();
                            continue;
                        }

                        key_post = key;
                        result_post_to_contract =
                            feed.read().unwrap().get_feed_type().process(values); // Dispatch to concreate FeedProcessing implementation.
                        println!("result_post_to_contract = {:?}", result_post_to_contract);
                        feed.write().unwrap().inc_slot();
                        reports.clear();
                    }

                    eth_send_to_contract(
                        to_hex_string(key_post.to_be_bytes().to_vec()).as_str(),
                        result_post_to_contract.as_str(),
                    )
                    .await
                    .unwrap();
                }
            });
        }
    }

    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .service(get_key)
            .service(index)
            .service(hello)
            .service(index_post)
    })
    .bind(("0.0.0.0", 8877))?
    .run()
    .await
}
