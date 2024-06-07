//! Example of deploying a contract from an artifact to Anvil and interacting with it.

use alloy::{
    hex::FromHex, network::TransactionBuilder, primitives::Bytes, providers::Provider,
    rpc::types::eth::TransactionRequest,
};

use eyre::Result;
use sequencer::utils::time_utils::get_ms_since_epoch;
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
use sequencer::utils::{byte_utils::to_hex_string, eth_send_utils::deploy_contract, provider::*};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

use eyre::eyre;
use sequencer::utils::logging::{init_shared_logging_handle, SharedLoggingHandle};
use tracing::info_span;
use tracing::{debug, error, info, trace};

//TODO: add schema for feed update
#[derive(Serialize, Deserialize)]
struct MyObj {
    name: String,
    number: i32,
}

use once_cell::sync::Lazy;
static PROVIDERS: Lazy<SharedRpcProviders> = Lazy::new(|| init_shared_rpc_providers());
static GLOBAL_LOG_HANDLE: Lazy<SharedLoggingHandle> = Lazy::new(|| init_shared_logging_handle());

async fn get_key_from_contract(network: &String, key: &String) -> Result<String> {
    let providers = PROVIDERS
        .read()
        .expect("Could not lock all providers' lock");

    let provider = providers.get(network);

    if let Some(p) = provider.cloned() {
        drop(providers);
        let p = p.lock().await;

        let wallet = &p.wallet;
        let provider = &p.provider;
        let contract_address = &p.contract_address;
        if let Some(addr) = contract_address {
            info!(
                "sending data to contract_address `{}` in network `{}`",
                addr, network
            );

            let base_fee = provider.get_gas_price().await?;

            // key: 0x00000000
            let input = match Bytes::from_hex(key) {
                Err(e) => return Err(eyre!("Key is not valid hex string: {}", e)),
                Ok(x) => x,
            };
            let tx = TransactionRequest::default()
                .to(*addr)
                .from(wallet.address())
                .with_gas_limit(2e5 as u128)
                .with_max_fee_per_gas(base_fee + base_fee)
                .with_max_priority_fee_per_gas(1e9 as u128)
                .with_chain_id(provider.get_chain_id().await?)
                .input(Some(input).into());

            let result = provider.call(&tx).await?;
            info!("Call result: {:?}", result);
            return Ok(result.to_string());
        }
        return Err(eyre!("No contract found for network {}", network));
    }
    return Err(eyre!("No provider found for network {}", network));
}

#[get("/deploy/{network}")]
async fn deploy(path: web::Path<String>) -> Result<HttpResponse, Error> {
    let span = info_span!("deploy");
    let _guard = span.enter();
    let network = path.into_inner();
    info!("Deploying contract for network `{}` ...", network);
    match deploy_contract(&network, &PROVIDERS).await {
        Ok(result) => Ok(HttpResponse::Ok()
            .content_type(ContentType::plaintext())
            .body(result)),
        Err(e) => {
            error!("Failed to deploy due to: {}", e.to_string());
            Err(error::ErrorBadRequest(e.to_string()))
        }
    }
}

#[get("/get_key/{network}/{key}")] // network is the name provided in config, key is hex string
async fn get_key(req: HttpRequest) -> impl Responder {
    let span = info_span!("get_key");
    let _guard = span.enter();
    let bad_input = error::ErrorBadRequest("Incorrect input.");
    let network: String = req.match_info().get("network").ok_or(bad_input)?.parse()?;
    let key: String = req.match_info().query("key").parse()?;
    info!("getting key {} for network {} ...", key, network);
    match get_key_from_contract(&network, &key).await {
        Ok(result) => Ok(HttpResponse::Ok()
            .content_type(ContentType::plaintext())
            .body(result)),
        Err(e) => Err(error::ErrorBadRequest(e.to_string())),
    }
}

#[post("/main_log_level/{log_level}")]
async fn set_log_level(req: HttpRequest) -> Result<HttpResponse, Error> {
    let bad_input = error::ErrorBadRequest("Incorrect input.");
    let log_level: String = req
        .match_info()
        .get("log_level")
        .ok_or(bad_input)?
        .parse()?;
    info!("set_log_level called with {}", log_level);
    if let Some(val) = req.connection_info().realip_remote_addr() {
        if val == "127.0.0.1" {
            if GLOBAL_LOG_HANDLE
                .lock()
                .expect("Could not acquire GLOBAL_LOG_HANDLE's mutex")
                .set_logging_level(log_level.as_str())
            {
                return Ok(HttpResponse::Ok().into());
            }
        }
    }
    Ok(HttpResponse::BadRequest().into())
}

const MAX_SIZE: usize = 262_144; // max payload size is 256k

#[post("/{name}")]
async fn index_post(
    name: web::Path<String>,
    mut payload: web::Payload,
    app_state: web::Data<FeedsState>,
) -> Result<HttpResponse, Error> {
    debug!("Called index_post {}", name);
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
    debug!("body = {:?}!", body);

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

    trace!(
        "result = {:?}; feed_id = {:?}; reporter_id = {:?}",
        result_hex,
        feed_id,
        reporter_id
    );
    let feed;
    {
        let reg = app_state
            .registry
            .read()
            .expect("Error trying to lock Registry for read!");
        debug!("getting feed_id = {}", &feed_id);
        feed = match reg.get(feed_id.into()) {
            Some(x) => x,
            None => return Ok(HttpResponse::BadRequest().into()),
        };
    }

    let current_time_as_ms = get_ms_since_epoch();

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
    // init global logger.
    drop(
        GLOBAL_LOG_HANDLE
            .lock()
            .expect("Could not acquire GLOBAL_LOG_HANDLE's mutex"),
    );

    let app_state = web::Data::new(FeedsState {
        registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_with_test_data())),
        reports: Arc::new(RwLock::new(AllFeedsReports::new())),
    });

    let mut feed_managers = Vec::new();

    let (vote_send, vote_recv) = mpsc::unbounded_channel();

    {
        let reg = app_state
            .registry
            .write()
            .expect("Could not lock all feeds meta data registry.");
        let keys = reg.get_keys();
        for key in keys {
            let send_channel: mpsc::UnboundedSender<(String, String)> = vote_send.clone();

            debug!("key = {} : value = {:?}", key, reg.get(key));

            let feed = match reg.get(key) {
                Some(x) => x,
                None => panic!("Error timer for feed that was not registered."),
            };

            let lock_err_msg = "Could not lock feed meta data registry for read";
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
            .service(set_log_level)
    })
    .bind(("0.0.0.0", 8877))?
    .run()
    .await
}
