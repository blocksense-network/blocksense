//! Example of deploying a contract from an artifact to Anvil and interacting with it.

use alloy::{
    hex::FromHex, network::TransactionBuilder, primitives::Bytes, providers::Provider,
    rpc::types::eth::TransactionRequest,
};

use eyre::Result;
use std::sync::{Arc, RwLock};

use actix_web::http::header::ContentType;
use actix_web::{error, Error};
use actix_web::{get, web, App, HttpRequest, HttpServer};
use actix_web::{post, HttpResponse, Responder};
use futures::StreamExt;
use sequencer::feeds::feed_slots_manager::FeedSlotsManager;
use sequencer::feeds::feeds_processing::REPORT_HEX_SIZE;
use sequencer::feeds::feeds_registry::{
    get_feed_id, new_feeds_meta_data_reg_with_test_data, AllFeedsReports,
};
use sequencer::feeds::feeds_state::FeedsState;
use sequencer::feeds::{
    votes_result_batcher::VotesResultBatcher, votes_result_sender::VotesResultSender,
};
use sequencer::utils::{
    byte_utils::to_hex_string, eth_send_to_contract::DataFeedStoreV1, provider::*,
};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::mpsc;

//TODO: add schema for feed update
#[derive(Serialize, Deserialize)]
struct MyObj {
    name: String,
    number: i32,
}

use once_cell::sync::Lazy;
static PROVIDERS: Lazy<SharedRpcProviders> = Lazy::new(|| get_shared_rpc_providers());

async fn deploy_contract(network: &String) -> Result<(bool, String)> {
    let providers = PROVIDERS
        .read()
        .expect("Error locking all providers mutex.");

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

        return Ok((
            true,
            format!("CONTRACT_ADDRESS set to {}", contract_address.to_string()),
        ));
    }
    return Ok((false, format!("No provider for network {}", network)));
}

async fn get_key_from_contract(network: &String, key: &String) -> Result<(bool, String)> {
    let providers = PROVIDERS
        .read()
        .expect("Error locking all providers mutex.");

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
            return Ok((true, result.to_string()));
        }
        return Ok((false, format!("No contract found for network {}", network)));
    }
    return Ok((false, format!("No provider found for network {}", network)));
}

#[get("/deploy/{network}")]
async fn deploy(path: web::Path<String>) -> Result<HttpResponse, Error> {
    let network = path.into_inner();
    println!("Deploying contract for network `{}` ...", network);
    match deploy_contract(&network).await {
        Ok((true, result)) => Ok(HttpResponse::Ok()
            .content_type(ContentType::plaintext())
            .body(result)),
        Ok((false, result)) => Err(error::ErrorBadRequest(result)),
        Err(e) => Err(error::ErrorBadRequest(e.to_string())),
    }
}

#[get("/get_key/{network}/{key}")] // network is the name provided in config, key is hex string
async fn get_key(req: HttpRequest) -> impl Responder {
    let network: String = req.match_info().get("network").unwrap().parse().unwrap();
    let key: String = req.match_info().query("key").parse().unwrap();
    println!("getting key {} for network {} ...", key, network);
    match get_key_from_contract(&network, &key).await {
        Ok((true, result)) => Ok(HttpResponse::Ok()
            .content_type(ContentType::plaintext())
            .body(result)),
        Ok((false, result)) => Err(error::ErrorBadRequest(result)),
        Err(e) => Err(error::ErrorBadRequest(e.to_string())),
    }
}

const MAX_SIZE: usize = 262_144; // max payload size is 256k

#[post("/{name}")]
async fn index_post(
    name: web::Path<String>,
    mut payload: web::Payload,
    app_state: web::Data<FeedsState>,
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
            to_hex_string(res, None)
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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let app_state = web::Data::new(FeedsState {
        registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_with_test_data())),
        reports: Arc::new(RwLock::new(AllFeedsReports::new())),
    });

    let mut feed_managers = Vec::new();

    let (vote_send, vote_recv) = mpsc::unbounded_channel();

    {
        let reg = app_state.registry.write().unwrap();
        let keys = reg.get_keys();
        for key in keys {
            let send_channel: mpsc::UnboundedSender<(String, String)> = vote_send.clone();

            println!("key = {} : value = {:?}", key, reg.get(key));

            let feed = match reg.get(key) {
                Some(x) => x,
                None => panic!("Error timer for feed that was not registered."),
            };

            let lock_err_msg = "Could not lock feeds meta data registry for read";
            let name = feed.read().expect(lock_err_msg).get_name().clone();
            let report_interval_ms = feed.read().expect(lock_err_msg).get_report_interval_ms();
            let first_report_start_time = feed
                .read()
                .expect(lock_err_msg)
                .get_first_report_start_time_ms();

            feed_managers.push(FeedSlotsManager::new(
                send_channel,
                feed,
                name,
                report_interval_ms,
                first_report_start_time,
                app_state.clone(),
                key,
            ));
        }
    }

    let (batched_votes_send, batched_votes_recv) = mpsc::unbounded_channel();

    let _votes_batcher = VotesResultBatcher::new(vote_recv, batched_votes_send);

    let _votes_sender = VotesResultSender::new(batched_votes_recv, PROVIDERS.clone());

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
