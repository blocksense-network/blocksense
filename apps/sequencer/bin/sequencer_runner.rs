//! Example of deploying a contract from an artifact to Anvil and interacting with it.

use alloy::{
    hex::FromHex, network::TransactionBuilder, primitives::Bytes, providers::Provider,
    rpc::types::eth::TransactionRequest,
};

use eyre::Result;
use std::sync::{Arc, RwLock};

use sequencer::feeds::feeds_registry::{
    get_feed_id, new_feeds_meta_data_reg_with_test_data, AllFeedsReports, FeedMetaData,
    FeedMetaDataRegistry, FeedSlotTimeTracker,
};

use actix_web::{error, rt::spawn, Error};
use actix_web::{get, web, App, HttpRequest, HttpServer};
use actix_web::{post, HttpResponse, Responder};
use futures::StreamExt;
use sequencer::feeds::feeds_processing::REPORT_HEX_SIZE;
use sequencer::utils::byte_utils::to_hex_string;
use sequencer::utils::eth_send_to_contract::{eth_batch_send_to_all_contracts, DataFeedStoreV1};
use sequencer::utils::provider::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::time::Duration;

//TODO: add schema for feed update
#[derive(Serialize, Deserialize)]
struct MyObj {
    name: String,
    number: i32,
}

use once_cell::sync::Lazy;
static PROVIDERS: Lazy<SharedRpcProviders> = Lazy::new(|| get_shared_rpc_providers());

async fn deploy_contract(network: &String) -> Result<String> {
    let providers = PROVIDERS.lock().await;

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
        let contract_address = contract_builder
            .gas(estimate)
            .gas_price(base_fee)
            .deploy()
            .await?;

        println!(
            "Deployed contract at address: {:?}\n",
            contract_address.to_string()
        );

        p.contract_address = Some(contract_address);

        return Ok(format!(
            "CONTRACT_ADDRESS set to {}",
            contract_address.to_string()
        ));
    }
    return Ok(format!("No provider for network {}", network));
}

async fn get_key_from_contract(network: &String, key: &String) -> Result<String> {
    let providers = PROVIDERS.lock().await;

    let provider = providers.get(network);

    if let Some(p) = provider.cloned() {
        drop(providers);
        let p = p.lock().await;

        let wallet = &p.wallet;
        let provider = &p.provider;
        let contract_address = &p.contract_address;
        if let Some(addr) = contract_address {
            println!("sending data to contract_address `{}`", addr);

            let base_fee = provider.get_gas_price().await?;

            // key: 0x00000000
            let input = Bytes::from_hex(key).unwrap();
            let tx = TransactionRequest::default()
                .to(*addr)
                .from(wallet.address())
                .with_gas_limit(2e5 as u128)
                .with_max_fee_per_gas(base_fee + base_fee)
                .with_max_priority_fee_per_gas(1e9 as u128)
                .with_chain_id(provider.get_chain_id().await?)
                .input(Some(input).into());

            let result = provider.call(&tx).await?;
            println!("Call result: {:?}", result);
            return Ok(result.to_string());
        }
        return Ok(format!("No contract found for network {}", network));
    }
    return Ok(format!("No provider found for network {}", network));
}

#[get("/deploy/{network}")]
async fn deploy(path: web::Path<String>) -> impl Responder {
    let network = path.into_inner();
    println!("Deploying contract for network `{}` ...", network);
    match deploy_contract(&network).await {
        Ok(result) => return result,
        Err(_) => return format!("Could not depoloy contract for {network}").to_string(),
    };
}

#[get("/get_key/{network}/{key}")] // network is the name provided in config, key is hex string
async fn get_key(req: HttpRequest) -> impl Responder {
    let network: String = req.match_info().get("network").unwrap().parse().unwrap();
    let key: String = req.match_info().query("key").parse().unwrap();
    println!("getting key {} for network {} ...", key, network);
    get_key_from_contract(&network, &key).await.unwrap()
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

    let v: serde_json::Value = serde_json::from_str(std::str::from_utf8(&body)?)?;
    let result_hex = match v["result"].to_string().parse::<f32>() {
        Ok(x) => {
            let mut res = x.to_be_bytes().to_vec();
            res.resize(REPORT_HEX_SIZE / 2, 0);
            to_hex_string(res)
        }
        Err(_) => {
            let value = v["result"].to_string();
            if value.len() != REPORT_HEX_SIZE
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

    let (vote_send, vote_recv) = async_channel::unbounded();

    {
        let reg = app_state.registry.write().unwrap();
        let keys = reg.get_keys();
        for key in keys {
            let send_channel = vote_send.clone();
            let feed = reg.get(key).unwrap();
            let feed = feed.read().unwrap();
            let name = feed.get_name().clone();
            let report_interval = feed.get_report_interval();
            let first_report_start_time = feed.get_first_report_start_time_ms();

            println!("key = {} : value = {:?}", key, reg.get(key));

            let app_state_clone: web::Data<AppState> = app_state.clone(); //This will be moved into the spawned timer below

            spawn(async move {
                let feed_slots_tracker =
                    FeedSlotTimeTracker::new(report_interval, first_report_start_time);

                loop {
                    feed_slots_tracker.await_end_of_current_slot().await;

                    let result_post_to_contract: String;
                    let key_post: u32;
                    {
                        let feed: Arc<RwLock<FeedMetaData>>;
                        {
                            let reg = app_state_clone.registry.write().unwrap();
                            feed = match reg.get(key) {
                                Some(x) => x,
                                None => panic!("Error timer for feed that was not registered."),
                            };
                        }

                        let current_time_as_ms = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .expect("Time went backwards")
                            .as_millis();

                        let slot = feed.read().unwrap().get_slot(current_time_as_ms);
                        println!("processing votes for feed_id = {}, slot = {}", &key, &slot);

                        println!(
                            "Tick from {} with id {} rep_interval {}.",
                            name, key, report_interval
                        );

                        let reports = match app_state_clone.reports.read().unwrap().get(key) {
                            Some(x) => x,
                            None => {
                                println!("No reports found!");
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
                            continue;
                        }

                        key_post = key;
                        result_post_to_contract =
                            feed.read().unwrap().get_feed_type().process(values); // Dispatch to concreate FeedProcessing implementation.
                        println!("result_post_to_contract = {:?}", result_post_to_contract);
                        reports.clear();
                    }

                    send_channel
                        .send((
                            to_hex_string(key_post.to_be_bytes().to_vec()),
                            result_post_to_contract,
                        ))
                        .await
                        .unwrap();
                }
            });
        }
    }

    let (batched_votes_send, batched_votes_recv) = async_channel::unbounded();

    spawn(async move {
        let max_keys_to_batch = 2;
        loop {
            let mut updates: HashMap<String, String> = Default::default();
            let mut send_to_contract = false;
            while !send_to_contract {
                let var = actix_web::rt::time::timeout(Duration::from_millis(500), async {
                    vote_recv.recv().await
                })
                .await;
                match var {
                    Ok(Ok((key, val))) => {
                        println!("adding {} => {} to updates", key, val);
                        updates.insert(key, val);
                        send_to_contract = updates.keys().len() >= max_keys_to_batch;
                    }
                    Err(e) => {
                        println!("Flushing batched updates, {}", e.to_string());
                        send_to_contract = true;
                    }
                    Ok(Err(err)) => {
                        println!("Batcher got RecvError: {}", err.to_string());
                        send_to_contract = true;
                    }
                };
            }
            if updates.keys().len() > 0 {
                batched_votes_send.send(updates).await.unwrap();
            }
        }
    });

    spawn(async move {
        loop {
            let recvd = batched_votes_recv.recv().await;
            match recvd {
                Ok(updates) => {
                    println!("sending updates to contract:");
                    eth_batch_send_to_all_contracts(PROVIDERS.clone(), updates)
                        .await
                        .unwrap();
                    println!("Sending updates complete.");
                }
                Err(err) => {
                    println!("Sender got RecvError: {}", err.to_string());
                }
            }
        }
    });
    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .service(get_key)
            .service(deploy)
            .service(index_post)
    })
    .bind(("0.0.0.0", 8877))?
    .run()
    .await
}
