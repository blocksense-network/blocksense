use eyre::Result;

use super::super::feeds::feeds_state::FeedsState;
use actix_web::http::header::ContentType;
use actix_web::{error, Error};
use actix_web::{get, web, HttpRequest};
use actix_web::{post, HttpResponse, Responder};
use alloy::{
    hex::FromHex, network::TransactionBuilder, primitives::Bytes, providers::Provider,
    rpc::types::eth::TransactionRequest,
};
use eyre::eyre;

use super::super::providers::{eth_send_utils::deploy_contract, provider::SharedRpcProviders};
use tokio::time::Duration;
use tracing::info_span;
use tracing::{error, info};

async fn get_key_from_contract(
    providers: &SharedRpcProviders,
    network: &String,
    key: &String,
) -> Result<String> {
    let providers = providers
        .read()
        .expect("Could not lock all providers' lock");

    let provider = providers.get(network);

    let Some(p) = provider.cloned() else {
        return Err(eyre!("No provider found for network {}", network));
    };

    drop(providers);
    let p = p.lock().await;

    let wallet = &p.wallet;
    let provider = &p.provider;
    let contract_address = &p.contract_address;
    let Some(addr) = contract_address else {
        return Err(eyre!("No contract found for network {}", network));
    };
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
    let result = actix_web::rt::time::timeout(
        Duration::from_secs(7),
        get_key_from_contract(&app_state.providers, &network, &key),
    )
    .await;
    match result {
        Ok(Ok(result)) => Ok(HttpResponse::Ok()
            .content_type(ContentType::plaintext())
            .body(result)),
        Ok(Err(e)) => Err(error::ErrorInternalServerError(e.to_string())),
        Err(e) => Err(error::ErrorInternalServerError(e.to_string())),
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
