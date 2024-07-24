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
use crate::feeds::feeds_registry::Repeatability;
use feed_registry::types::FeedType;
use prometheus::metrics_collector::gather_and_dump_metrics;
use tokio::time::Duration;
use tracing::info_span;
use tracing::{debug, error, info};

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
    let input = Bytes::from_hex(key).map_err(|e| eyre!("Key is not valid hex string: {}", e))?;
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
    // TODO: get from metadata the type of the value.
    // TODO: Refector to not use dummy argument
    let return_val = match FeedType::from_bytes(result.to_vec(), FeedType::Numerical(0.0)) {
        Ok(val) => val,
        Err(e) => {
            return Err(eyre!("Could not deserialize feed from bytes {}", e));
        }
    };
    info!("Call result: {:?}", return_val);
    Ok(return_val.to_string())
}

#[get("/deploy/{network}/{feed_type}")]
async fn deploy(
    path: web::Path<(String, String)>,
    app_state: web::Data<FeedsState>,
) -> Result<HttpResponse, Error> {
    let span = info_span!("deploy");
    let _guard = span.enter();
    let (network, feed_type) = path.into_inner();
    info!(
        "Deploying contract for network `{}` and feed type `{}` ...",
        network, feed_type
    );

    let repeatability = match feed_type.as_str() {
        "price_feed" => Repeatability::Periodic,
        "event_feed" => Repeatability::Oneshot,
        _ => {
            let error_msg = format!("Invalid feed type: {}", feed_type);
            error!("{}", error_msg);
            return Err(error::ErrorBadRequest(error_msg));
        }
    };
    match deploy_contract(&network, &app_state.providers, repeatability).await {
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
        if val == "127.0.0.1"
            && app_state
                .log_handle
                .lock()
                .expect("Could not acquire GLOBAL_LOG_HANDLE's mutex")
                .set_logging_level(log_level.as_str())
        {
            return Ok(HttpResponse::Ok().into());
        }
    }
    Ok(HttpResponse::BadRequest().into())
}

#[get("/get_feed_report_interval/{feed_id}")]
async fn get_feed_report_interval(
    req: HttpRequest,
    app_state: web::Data<FeedsState>,
) -> Result<HttpResponse, Error> {
    let bad_input = error::ErrorBadRequest("Incorrect input.");
    let feed_id: String = req.match_info().get("feed_id").ok_or(bad_input)?.parse()?;

    let feed_id: u32 = match feed_id.parse() {
        Ok(r) => r,
        Err(e) => return Err(error::ErrorBadRequest(e.to_string())),
    };

    let feed = {
        let reg = app_state
            .registry
            .read()
            .expect("Error trying to lock Registry for read!");
        debug!("getting feed_id = {}", &feed_id);
        match reg.get(feed_id) {
            Some(x) => x,
            None => {
                drop(reg);
                return Ok(HttpResponse::BadRequest().into());
            }
        }
    };

    return Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(format!(
            "{}",
            feed.read()
                .expect("Error trying to lock Feed for read!")
                .get_report_interval_ms()
        )));
}

#[get("/metrics")]
async fn metrics() -> Result<HttpResponse, Error> {
    let output = match gather_and_dump_metrics() {
        Ok(result) => result,
        Err(e) => {
            return Err(error::ErrorInternalServerError(e.to_string()));
        }
    };

    return Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(output));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::config::init_sequencer_config;
    use crate::feeds::feeds_registry::{new_feeds_meta_data_reg_from_config, AllFeedsReports};
    use crate::providers::provider::init_shared_rpc_providers;
    use crate::reporters::reporter::init_shared_reporters;
    use crate::utils::logging::init_shared_logging_handle;
    use actix_web::{http::header::ContentType, test, App};
    use alloy::node_bindings::Anvil;
    use regex::Regex;
    use sequencer_config::get_test_config_with_single_provider;
    use std::env;
    use std::fs::File;
    use std::io::Write;
    use std::path::PathBuf;
    use std::sync::{Arc, RwLock};

    #[actix_web::test]
    async fn test_get_feed_report_interval() {
        let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let tests_dir_path = PathBuf::new().join(manifest_dir).join("tests");
        env::set_var("SEQUENCER_CONFIG_DIR", tests_dir_path);
        let log_handle = init_shared_logging_handle();
        let sequencer_config = init_sequencer_config();

        let providers =
            init_shared_rpc_providers(&sequencer_config, Some("test_get_feed_report_interval_"))
                .await;

        let app_state = web::Data::new(FeedsState {
            registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_from_config(
                &sequencer_config,
            ))),
            reports: Arc::new(RwLock::new(AllFeedsReports::new())),
            providers: providers.clone(),
            log_handle,
            reporters: init_shared_reporters(
                &sequencer_config,
                Some("test_get_feed_report_interval_"),
            ),
        });

        let app = test::init_service(
            App::new()
                .app_data(app_state.clone())
                .service(get_feed_report_interval),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/get_feed_report_interval/1")
            .to_request();

        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body = test::read_body(resp).await;
        let body_str = std::str::from_utf8(&body).expect("Failed to read body");
        assert_eq!(body_str, "30000");
    }

    async fn create_app_state_from_sequencer_config(
        network: &str,
        key_path: &str,
        anvil_endpoint: &str,
    ) -> web::Data<FeedsState> {
        let cfg = get_test_config_with_single_provider(network, key_path, anvil_endpoint);

        let providers =
            init_shared_rpc_providers(&cfg, Some("create_app_state_from_sequencer_config_")).await;

        let log_handle = init_shared_logging_handle();

        web::Data::new(FeedsState {
            registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_from_config(&cfg))),
            reports: Arc::new(RwLock::new(AllFeedsReports::new())),
            providers: providers.clone(),
            log_handle,
            reporters: init_shared_reporters(&cfg, Some("create_app_state_from_sequencer_config_")),
        })
    }

    #[actix_web::test]
    async fn test_deploy_endpoint_success() {
        const HTTP_STATUS_SUCCESS: u16 = 200;

        let anvil = Anvil::new().try_spawn().unwrap();
        let key_path = "/tmp/priv_key_test";
        let network = "ETH137";

        let cfg =
            get_test_config_with_single_provider(network, key_path, anvil.endpoint().as_str());

        let app_state =
            create_app_state_from_sequencer_config(network, key_path, anvil.endpoint().as_str())
                .await;

        // Initialize the service
        let app = test::init_service(App::new().app_data(app_state.clone()).service(deploy)).await;

        fn extract_eth_address(message: &str) -> Option<String> {
            let re = Regex::new(r"0x[a-fA-F0-9]{40}").expect("Invalid regex");
            if let Some(mat) = re.find(message) {
                return Some(mat.as_str().to_string());
            }
            None
        }

        let feed_types = vec!["price_feed", "event_feed"];

        for feed_type in feed_types {
            // Test deploy contract
            let req = test::TestRequest::get()
                .uri(&format!("/deploy/{}/{}", network, feed_type))
                .to_request();

            let resp = test::call_service(&app, req).await;
            assert_eq!(resp.status(), HTTP_STATUS_SUCCESS);
            let body = test::read_body(resp).await;
            let body_str = std::str::from_utf8(&body).expect("Failed to read body");
            println!("body_str: {:?}", body_str);
            let contract_address = extract_eth_address(body_str).unwrap();
            println!("contract_address: {:?}", contract_address);
            assert_eq!(body_str.len(), 66);
        }

        // Test deploy unknown feed type returns 400
        let req = test::TestRequest::get()
            .uri(&format!("/deploy/{}/unknown_feed", network))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 400);
    }
}
