use super::super::utils::time_utils::get_ms_since_epoch;
use eyre::Result;

use super::super::feeds::feeds_processing::REPORT_HEX_SIZE;
use super::super::feeds::feeds_registry::{get_feed_id, ReportRelevance};
use super::super::feeds::feeds_state::FeedsState;
use actix_multipart::Multipart;
use actix_web::error::ErrorBadRequest;
use actix_web::http::header::ContentType;
use actix_web::{error, Error};
use actix_web::{get, web, HttpRequest};
use actix_web::{post, HttpResponse, Responder};
use alloy::{
    hex::FromHex, network::TransactionBuilder, primitives::Bytes, providers::Provider,
    rpc::types::eth::TransactionRequest,
};
use eyre::eyre;
use futures::StreamExt;

use super::super::providers::{eth_send_utils::deploy_contract, provider::SharedRpcProviders};
use super::super::utils::byte_utils::to_hex_string;
use tracing::info_span;
use tracing::{debug, error, info, trace, warn};

use crate::inc_reporter_metric;

const MAX_SIZE: usize = 262_144; // max payload size is 256k

#[post("/{name}")]
pub async fn index_post(
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

    let reporter_id = match v["reporter_id"].to_string().parse::<u64>() {
        Ok(x) => x,
        Err(_) => {
            return Ok(HttpResponse::BadRequest().into());
        }
    };

    let feed_id = get_feed_id(v["feed_id"].to_string().as_str());

    let reporter = {
        let reporters = app_state.reporters.read().unwrap();
        let reporter = reporters.get_key_value(&reporter_id);
        match reporter {
            Some(x) => {
                //TODO: Check signature of vote!
                x.1.clone()
            }
            None => {
                warn!(
                    "Recvd vote from reporter with unregistered ID = {}!",
                    reporter_id
                );
                return Ok(HttpResponse::BadRequest().into());
            }
        }
    };

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
                inc_reporter_metric!(reporter, unrecognized_result_format);
                return Ok(HttpResponse::BadRequest().into());
            }
            value
        }
    };

    let msg_timestamp = match v["timestamp"].to_string().parse::<u128>() {
        Ok(x) => x,
        Err(_) => {
            inc_reporter_metric!(reporter, json_scheme_error);
            return Ok(HttpResponse::BadRequest().into());
        }
    };

    trace!(
        "result = {:?}; feed_id = {:?}; reporter_id = {:?}",
        result_hex,
        feed_id,
        reporter_id
    );
    let feed = {
        let reg = app_state
            .registry
            .read()
            .expect("Error trying to lock Registry for read!");
        debug!("getting feed_id = {}", &feed_id);
        match reg.get(feed_id.into()) {
            Some(x) => x,
            None => {
                drop(reg);
                inc_reporter_metric!(reporter, non_valid_feed_id_reports);
                return Ok(HttpResponse::BadRequest().into());
            }
        }
    };

    let current_time_as_ms = get_ms_since_epoch();

    // check if the time stamp in the msg is <= current_time_as_ms
    // and check if it is inside the current active slot frame.
    let report_relevance = {
        let feed = feed.read().expect("Error trying to lock Feed for read!");
        feed.check_report_relevance(current_time_as_ms, msg_timestamp)
    };

    match report_relevance {
        ReportRelevance::Relevant => {
            let mut reports = app_state
                .reports
                .write()
                .expect("Error trying to lock Reports for read!");
            if reports.push(feed_id.into(), reporter_id, result_hex) {
                inc_reporter_metric!(reporter, total_accepted_feed_votes);
            } else {
                inc_reporter_metric!(reporter, total_revotes_for_same_slot);
            }
            return Ok(HttpResponse::Ok().into()); // <- send response
        }
        ReportRelevance::NonRelevantOld => {
            inc_reporter_metric!(reporter, late_reports);
        }
        ReportRelevance::NonRelevantInFuture => {
            inc_reporter_metric!(reporter, reports_in_future);
        }
    }
    Ok(HttpResponse::BadRequest().into())
}

async fn get_key_from_contract(
    providers: &SharedRpcProviders,
    network: &String,
    key: &String,
) -> Result<String> {
    let providers = providers
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
async fn deploy(
    path: web::Path<String>,
    app_state: web::Data<FeedsState>,
) -> Result<HttpResponse, Error> {
    let span = info_span!("deploy");
    let _guard = span.enter();
    let network = path.into_inner();
    info!("Deploying contract for network `{}` ...", network);
    match deploy_contract(&network, &app_state.providers).await {
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
async fn get_key(req: HttpRequest, app_state: web::Data<FeedsState>) -> impl Responder {
    let span = info_span!("get_key");
    let _guard = span.enter();
    let bad_input = error::ErrorBadRequest("Incorrect input.");
    let network: String = req.match_info().get("network").ok_or(bad_input)?.parse()?;
    let key: String = req.match_info().query("key").parse()?;
    info!("getting key {} for network {} ...", key, network);
    match get_key_from_contract(&app_state.providers, &network, &key).await {
        Ok(result) => Ok(HttpResponse::Ok()
            .content_type(ContentType::plaintext())
            .body(result)),
        Err(e) => Err(error::ErrorBadRequest(e.to_string())),
    }
}

#[post("/main_log_level/{log_level}")]
async fn set_log_level(
    req: HttpRequest,
    app_state: web::Data<FeedsState>,
) -> Result<HttpResponse, Error> {
    let bad_input = error::ErrorBadRequest("Incorrect input.");
    let log_level: String = req
        .match_info()
        .get("log_level")
        .ok_or(bad_input)?
        .parse()?;
    info!("set_log_level called with {}", log_level);
    if let Some(val) = req.connection_info().realip_remote_addr() {
        if val == "127.0.0.1" {
            if app_state
                .log_handle
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

const MAX_PLUGIN_SIZE: usize = 1_000_000; // max payload size is 900kb

/// Uploads a WebAssembly plugin to the registry.
///
/// This endpoint accepts a multipart/form-data POST request with the following fields:
/// - `name`: The name of the plugin (string).
/// - `namespace`: The namespace of the plugin (string).
/// - `wasm`: The WebAssembly file to be uploaded (file, max size 1MB).
///
/// Example `curl` request:
/// ```sh
/// curl -X POST http://localhost:8877/registry/plugin/upload \
///   -F "name=plugin_name" \
///   -F "namespace=plugin_namespace" \
///   -F "wasm=@path/to/your/file.wasm"
/// ```
///
/// # Errors
/// Returns HTTP 400 if any of the fields are missing or if the file size exceeds the limit.
#[post("/registry/plugin/upload")]
async fn registry_plugin_upload(
    mut payload: Multipart,
    app_state: web::Data<FeedsState>,
) -> Result<HttpResponse, Error> {
    println!("Called registry_plugin_upload");

    let mut name = String::new();
    let mut namespace = String::new();
    let mut wasm_file = None;

    while let Some(Ok(mut field)) = payload.next().await {
        let field_name = field.name();

        if field_name == "name" {
            while let Some(chunk) = field.next().await {
                name.push_str(&String::from_utf8(chunk?.to_vec()).unwrap());
            }
        } else if field_name == "namespace" {
            while let Some(chunk) = field.next().await {
                namespace.push_str(&String::from_utf8(chunk?.to_vec()).unwrap());
            }
        } else if field_name == "wasm" {
            let mut file_bytes = web::BytesMut::new();
            while let Some(chunk) = field.next().await {
                let chunk = chunk?;
                if (file_bytes.len() + chunk.len()) > MAX_PLUGIN_SIZE {
                    return Err(error::ErrorBadRequest("File size exceeds the limit of 1MB"));
                }
                file_bytes.extend_from_slice(&chunk);
            }
            wasm_file = Some(file_bytes);
        }
    }

    // TODO (Dilyan Dokov): Validate name, namespace and wasm present. Return http 400 otherwise.
    // TODO (Dilyan Dokov): Sanitize string for dangerous characters
    {
        let mut reg = app_state
            .plugin_registry
            .write()
            .unwrap_or_else(|poisoned| {
                // Handle mutex poisoning
                let guard = poisoned.into_inner();
                guard
            });
        let registry_key = format!("{}:{}", namespace, name);
        if wasm_file.is_none() {
            return Err(ErrorBadRequest("No file sent"));
        }
        let wasm_file_bytes = wasm_file.unwrap();
        reg.insert(registry_key, wasm_file_bytes.to_vec())
            .map_err(|_e| ErrorBadRequest("Plugin registry capacity reached"))?;
        // Releasing plugin_registry rwlock
    }

    Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(""))
}

/// Retrieves a WebAssembly plugin from the registry.
///
/// This endpoint accepts a GET request with the following path parameters:
/// - `namespace`: The namespace of the plugin (string).
/// - `name`: The name of the plugin (string).
///
/// Example `curl` request:
/// ```sh
/// curl -X GET "http://localhost:8877/registry/plugin/get/plugin_namespace/plugin_name" -o downloaded_plugin.wasm
/// ```
///
/// # Errors
/// Returns HTTP 404 if the specified plugin is not found.
#[get("/registry/plugin/get/{namespace}/{name}")]
async fn registry_plugin_get(
    path: web::Path<(String, String)>,
    app_state: web::Data<FeedsState>,
) -> Result<HttpResponse, Error> {
    let (namespace, name) = path.into_inner();
    println!("Called registry_plugin_get {}:{}", namespace, name);

    let plugin_file;
    {
        let reg = app_state.plugin_registry.read().unwrap();
        let registry_key = format!("{}:{}", namespace, name);
        plugin_file = reg
            .get(&registry_key)
            .ok_or_else(|| actix_web::error::ErrorNotFound("Plugin not found"))?;

        Ok(HttpResponse::Ok()
            .content_type("application/wasm")
            .body(plugin_file.clone()))
    }
}

/// Retrieves the current memory usage of the plugin registry.
///
/// This endpoint accepts a GET request and returns the current memory usage in bytes.
///
/// Example `curl` request:
/// ```sh
/// curl -X GET http://localhost:8877/registry/plugin/size
/// ```
///
/// # Returns
/// - The current memory usage of the plugin registry in bytes as a plain text response.
#[get("/registry/plugin/size")]
async fn registry_plugin_size(app_state: web::Data<FeedsState>) -> Result<HttpResponse, Error> {
    println!("Called registry_plugin_size");
    let registry_size;
    {
        let reg = app_state.plugin_registry.write().unwrap();
        registry_size = reg.current_memory_usage;
    }
    Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(registry_size.to_string()))
}
