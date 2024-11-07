use crate::feeds::feeds_slots_manager::{FeedsSlotsManagerCmds, RegisterNewAssetFeed};
use crate::http_handlers::MAX_SIZE;
use crate::sequencer_state::SequencerState;
use actix_web::http::header::ContentType;
use actix_web::{error, Error};
use actix_web::{get, web, HttpRequest};
use actix_web::{post, HttpResponse, Responder};
use alloy::{
    hex::FromHex, network::TransactionBuilder, primitives::Bytes, providers::Provider,
    rpc::types::eth::TransactionRequest,
};
use config::{AllFeedsConfig, FeedConfig, SequencerConfig};
use eyre::eyre;
use eyre::Result;
use futures::StreamExt;
use utils::logging::tokio_console_active;

use super::super::providers::{eth_send_utils::deploy_contract, provider::SharedRpcProviders};
use feed_registry::types::FeedType;
use feed_registry::types::Repeatability;
use prometheus::metrics_collector::gather_and_dump_metrics;
use tokio::time::Duration;
use tracing::info_span;
use tracing::{debug, error, info};

async fn get_key_from_contract(
    providers: &SharedRpcProviders,
    network: &String,
    key: String,
) -> Result<String> {
    let providers = providers.read().await;

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

    let mut selector = key;
    selector.replace_range(0..1, "8"); // 8 indicates we want to take the latest value.
                                       // key: 0x00000000
    let input =
        Bytes::from_hex(selector).map_err(|e| eyre!("Key is not valid hex string: {}", e))?;
    let tx = TransactionRequest::default()
        .to(*addr)
        .from(wallet.address())
        .with_gas_limit(75e5 as u128)
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
    Ok(return_val.parse_to_string())
}

#[get("/deploy/{network}/{feed_type}")]
pub async fn deploy(
    path: web::Path<(String, String)>,
    sequencer_state: web::Data<SequencerState>,
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
    match deploy_contract(&network, &sequencer_state.providers, repeatability).await {
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
pub async fn get_key(
    req: HttpRequest,
    sequencer_state: web::Data<SequencerState>,
) -> impl Responder {
    let span = info_span!("get_key");
    let _guard = span.enter();
    let bad_input = error::ErrorBadRequest("Incorrect input.");
    let network: String = req.match_info().get("network").ok_or(bad_input)?.parse()?;
    let key: String = req.match_info().query("key").parse()?;
    info!("getting key {} for network {} ...", key, network);
    let result = actix_web::rt::time::timeout(
        Duration::from_secs(7),
        get_key_from_contract(&sequencer_state.providers, &network, key),
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
pub async fn set_log_level(
    req: HttpRequest,
    sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    if tokio_console_active("SEQUENCER") {
        return Ok(HttpResponse::NotAcceptable().into());
    } else {
        let bad_input = error::ErrorBadRequest("Incorrect input.");
        let log_level: String = req
            .match_info()
            .get("log_level")
            .ok_or(bad_input)?
            .parse()?;
        info!("set_log_level called with {}", log_level);
        if let Some(val) = req.connection_info().realip_remote_addr() {
            if val == "127.0.0.1"
                && sequencer_state
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

#[get("/get_feed_report_interval/{feed_id}")]
pub async fn get_feed_report_interval(
    req: HttpRequest,
    sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    let bad_input = error::ErrorBadRequest("Incorrect input.");
    let feed_id: String = req.match_info().get("feed_id").ok_or(bad_input)?.parse()?;

    let feed_id: u32 = match feed_id.parse() {
        Ok(r) => r,
        Err(e) => return Err(error::ErrorBadRequest(e.to_string())),
    };

    let feed = {
        let reg = sequencer_state.registry.read().await;
        debug!("getting feed_id = {}", &feed_id);
        match reg.get(feed_id) {
            Some(x) => x,
            None => {
                drop(reg);
                return Ok(HttpResponse::BadRequest().into());
            }
        }
    };

    Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(format!("{}", feed.read().await.get_report_interval_ms())))
}

#[get("/get_feeds_config")]
pub async fn get_feeds_config(
    sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    let feeds_config = sequencer_state.feeds_config.read().await;
    let feeds_config_pretty = serde_json::to_string_pretty::<AllFeedsConfig>(&feeds_config)?;

    Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(feeds_config_pretty.to_string()))
}

#[get("/get_feed_config/{feed_id}")]
pub async fn get_feed_config(
    req: HttpRequest,
    sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    let bad_input = error::ErrorBadRequest("Incorrect input.");
    let feed_id: String = req.match_info().get("feed_id").ok_or(bad_input)?.parse()?;

    let feed_id: u32 = match feed_id.parse() {
        Ok(r) => r,
        Err(e) => return Err(error::ErrorBadRequest(e.to_string())),
    };

    let feeds_config = sequencer_state.feeds_config.read().await.feeds.clone();
    let feed_config = feeds_config
        .into_iter()
        .find(|x| x.id == feed_id)
        .ok_or(error::ErrorNotFound("Data feed with this ID not found"))?;
    let feed_config_pretty = serde_json::to_string_pretty::<FeedConfig>(&feed_config)?;

    Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(feed_config_pretty.to_string()))
}

#[get("/get_sequencer_config")]
pub async fn get_sequencer_config(
    sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    let sequencer_config = sequencer_state.sequencer_config.read().await;
    let sequencer_config_pretty =
        serde_json::to_string_pretty::<SequencerConfig>(&sequencer_config)?;

    Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(sequencer_config_pretty.to_string()))
}

#[get("/metrics")]
async fn metrics() -> Result<HttpResponse, Error> {
    let output = match gather_and_dump_metrics() {
        Ok(result) => result,
        Err(e) => {
            return Err(error::ErrorInternalServerError(e.to_string()));
        }
    };

    Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(output))
}

#[post("/register_asset_feed")]
pub async fn register_asset_feed(
    mut payload: web::Payload,
    sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    let mut body = web::BytesMut::new();
    while let Some(chunk) = payload.next().await {
        let chunk = chunk?;
        // limit max size of in-memory payload
        if (body.len() + chunk.len()) > MAX_SIZE {
            return Err(error::ErrorBadRequest("overflow"));
        }
        body.extend_from_slice(&chunk);
    }

    debug!("revcd body = {:?}!", body);

    let new_feed_config: FeedConfig = serde_json::from_str(std::str::from_utf8(&body)?)?;

    {
        let reg = sequencer_state.registry.read().await;
        let keys = reg.get_keys();
        let new_feed_id = new_feed_config.id;

        if keys.contains(&new_feed_id) {
            let err_msg = format!(
                "Can not register this data feed. Feed with ID {new_feed_id} already exists."
            );
            error!(err_msg);
            return Err(error::ErrorBadRequest(err_msg));
        }
    }
    match sequencer_state.feeds_slots_manager_cmd_send.send(
        FeedsSlotsManagerCmds::RegisterNewAssetFeed(RegisterNewAssetFeed {
            config: new_feed_config.clone(),
        }),
    ) {
        Ok(_) => {
            info!("Scheduled registration of new asset data feed: {new_feed_config:?}",);
        }
        Err(e) => {
            panic!("Sequencer internal error, could not forward feed registration cmd {e}")
        }
    };

    Ok(HttpResponse::Ok().into())
}

async fn set_provider_is_enabled(
    req: HttpRequest,
    sequencer_state: web::Data<SequencerState>,
    is_enabled: bool,
) -> Result<HttpResponse, Error> {
    let network_name = req.match_info().get("network_name");

    let network_name: String = match network_name {
        Some(network_name) => network_name.parse()?,
        None => {
            let message = "Missing field 'network_name'";
            debug!("{message}");
            return Err(error::ErrorBadRequest(message));
        }
    };

    info!("reading previous state of 'is_enabled' for network {network_name}");

    let sequencer_config = sequencer_state.sequencer_config.read().await;
    let provider: &config::Provider = match sequencer_config.providers.get(&network_name) {
        Some(provider) => provider,
        None => {
            let message = format!("No provider for network {network_name}");
            debug!("{message}");
            return Err(error::ErrorBadRequest(message));
        }
    };
    info!("{network_name}.is_enabled = {}", provider.is_enabled);
    if provider.is_enabled == is_enabled {
        let message = if is_enabled {
            // Keeping this code less pretty so that it's easier to search for "already
            // enabled"/"already disabled", if the message shows up in logs.
            format!("Posting to {network_name} already enabled")
        } else {
            format!("Posting to {network_name} already disabled")
        };
        debug!("{message}");
        return Err(error::ErrorBadRequest(message));
    }

    // Important to drop read lock, otherwise trying to acquire a write lock will deadlock.
    drop(sequencer_config);

    let mut sequencer_config = sequencer_state.sequencer_config.write().await;
    let provider: &mut config::Provider =
        sequencer_config.providers.get_mut(&network_name).unwrap();
    provider.is_enabled = is_enabled;

    let message = if is_enabled {
        format!("posting to {network_name} successfully enabled")
    } else {
        format!("Posting to {network_name} successfully disabled")
    };
    info!("{message}");

    Ok(HttpResponse::Ok().into())
}

/// Disable posting to provider for the given network.
#[post("/disable_provider/{network_name}")]
pub async fn disable_provider(
    req: HttpRequest,
    sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    info!("endpoint disable_provider called");
    set_provider_is_enabled(req, sequencer_state, false).await
}

/// Enable posting to provider for the given network.
#[post("/enable_provider/{network_name}")]
pub async fn enable_provider(
    req: HttpRequest,
    sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    info!("endpoint enable_provider called");
    set_provider_is_enabled(req, sequencer_state, true).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::provider::init_shared_rpc_providers;
    use crate::reporters::reporter::init_shared_reporters;
    use actix_test::to_bytes;
    use actix_web::{test, App};
    use alloy::node_bindings::Anvil;
    use config::{get_sequencer_and_feed_configs, init_config};
    use config::{get_test_config_with_single_provider, AllFeedsConfig, SequencerConfig};
    use feed_registry::registry::{
        new_feeds_meta_data_reg_from_config, AllFeedsReports, FeedAggregateHistory,
    };
    use prometheus::metrics::FeedsMetrics;
    use regex::Regex;
    use std::env;
    use std::path::{Path, PathBuf};
    use std::sync::Arc;
    use tokio::sync::{mpsc, RwLock};
    use utils::constants::{FEEDS_CONFIG_DIR, FEEDS_CONFIG_FILE};
    use utils::get_config_file_path;
    use utils::logging::init_shared_logging_handle;
    use utils::test_env::get_test_private_key_path;

    #[actix_web::test]
    async fn test_get_feed_report_interval() {
        let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let sequencer_config_file = PathBuf::new()
            .join(manifest_dir)
            .join("tests")
            .join("sequencer_config.json");

        let log_handle = init_shared_logging_handle("INFO", false);
        let sequencer_config =
            init_config::<SequencerConfig>(&sequencer_config_file).expect("Failed to load config:");
        let feeds_config_file = get_config_file_path(FEEDS_CONFIG_DIR, FEEDS_CONFIG_FILE);
        let feeds_config =
            init_config::<AllFeedsConfig>(&feeds_config_file).expect("Failed to get config: ");
        let metrics_prefix = Some("test_get_feed_report_interval_");

        let providers = init_shared_rpc_providers(&sequencer_config, metrics_prefix).await;

        let (vote_send, _vote_recv) = mpsc::unbounded_channel();
        let (feeds_slots_manager_cmd_send, _feeds_slots_manager_cmd_recv) =
            mpsc::unbounded_channel();

        let sequencer_state = web::Data::new(SequencerState {
            registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_from_config(
                &feeds_config,
            ))),
            reports: Arc::new(RwLock::new(AllFeedsReports::new())),
            providers: providers.clone(),
            log_handle,
            reporters: init_shared_reporters(&sequencer_config, metrics_prefix),
            feed_id_allocator: Arc::new(RwLock::new(None)),
            voting_send_channel: vote_send,
            feeds_metrics: Arc::new(RwLock::new(
                FeedsMetrics::new(metrics_prefix.expect("Need to set metrics prefix in tests!"))
                    .expect("Failed to allocate feed_metrics"),
            )),
            feeds_config: Arc::new(RwLock::new(feeds_config)),
            sequencer_config: Arc::new(RwLock::new(sequencer_config.clone())),
            feed_aggregate_history: Arc::new(RwLock::new(FeedAggregateHistory::new())),
            feeds_slots_manager_cmd_send,
        });

        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
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
        assert_eq!(body_str, "300000");
    }

    async fn create_sequencer_state_from_sequencer_config(
        network: &str,
        key_path: &Path,
        anvil_endpoint: &str,
    ) -> web::Data<SequencerState> {
        let cfg = get_test_config_with_single_provider(network, key_path, anvil_endpoint);
        let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let sequencer_config_file = PathBuf::new()
            .join(manifest_dir)
            .join("tests")
            .join("sequencer_config.json");
        let sequencer_config =
            init_config::<SequencerConfig>(&sequencer_config_file).expect("Failed to load config:");

        let metrics_prefix = format!("create_sequencer_state_from_sequencer_config_{network}");
        let metrics_prefix = Some(metrics_prefix.as_str());

        let providers = init_shared_rpc_providers(&cfg, metrics_prefix).await;

        let log_handle = init_shared_logging_handle("INFO", false);

        let (vote_send, _vote_recv) = mpsc::unbounded_channel();
        let (feeds_slots_manager_cmd_send, _feeds_slots_manager_cmd_recv) =
            mpsc::unbounded_channel();

        let (_, feeds_config) = get_sequencer_and_feed_configs();

        web::Data::new(SequencerState {
            registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_from_config(
                &feeds_config,
            ))),
            reports: Arc::new(RwLock::new(AllFeedsReports::new())),
            providers,
            log_handle,
            reporters: init_shared_reporters(&cfg, metrics_prefix),
            feed_id_allocator: Arc::new(RwLock::new(None)),
            voting_send_channel: vote_send,
            feeds_metrics: Arc::new(RwLock::new(
                FeedsMetrics::new(metrics_prefix.expect("Need to set metrics prefix in tests!"))
                    .expect("Failed to allocate feed_metrics"),
            )),
            feeds_config: Arc::new(RwLock::new(feeds_config)),
            sequencer_config: Arc::new(RwLock::new(sequencer_config.clone())),
            feed_aggregate_history: Arc::new(RwLock::new(FeedAggregateHistory::new())),
            feeds_slots_manager_cmd_send,
        })
    }

    #[actix_web::test]
    async fn test_deploy_endpoint_success() {
        const HTTP_STATUS_SUCCESS: u16 = 200;

        let anvil = Anvil::new().try_spawn().unwrap();
        let key_path = get_test_private_key_path();
        let network = "ETH_test_deploy_endpoint_success";

        let sequencer_state = create_sequencer_state_from_sequencer_config(
            network,
            key_path.as_path(),
            anvil.endpoint().as_str(),
        )
        .await;

        // Initialize the service
        let app =
            test::init_service(App::new().app_data(sequencer_state.clone()).service(deploy)).await;

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

    #[actix_web::test]
    async fn test_get_configs() {
        let anvil = Anvil::new().try_spawn().unwrap();
        let key_path = get_test_private_key_path();
        let network = "ETH_test_get_configs";

        let sequencer_state = create_sequencer_state_from_sequencer_config(
            network,
            key_path.as_path(),
            anvil.endpoint().as_str(),
        )
        .await;

        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .service(get_feeds_config)
                .service(get_feed_config)
                .service(get_sequencer_config),
        )
        .await;

        let (_, feeds_config) = get_sequencer_and_feed_configs();

        {
            // test get_feeds_config
            let req = test::TestRequest::get()
                .uri("/get_feeds_config")
                .to_request();

            // Execute the request and read the response
            let resp = test::call_service(&app, req).await;
            assert_eq!(resp.status(), 200);

            let body = test::read_body(resp).await;
            let body_str = std::str::from_utf8(&body).expect("Failed to read body");

            let recvd_data: AllFeedsConfig =
                serde_json::from_str(body_str).expect("recvd_data is not valid JSON!");

            assert_eq!(recvd_data, feeds_config);
        }

        {
            // test get_feed_config
            {
                // positive test
                let feed_id = 0;
                let req = test::TestRequest::get()
                    .uri(format!("/get_feed_config/{feed_id}").as_str())
                    .to_request();

                // Execute the request and read the response
                let resp = test::call_service(&app, req).await;
                assert_eq!(resp.status(), 200);

                let body = test::read_body(resp).await;
                let body_str = std::str::from_utf8(&body).expect("Failed to read body");

                let recvd_data: FeedConfig =
                    serde_json::from_str(body_str).expect("recvd_data is not valid JSON!");

                assert_eq!(
                    recvd_data,
                    feeds_config
                        .feeds
                        .into_iter()
                        .find(|x| x.id == feed_id)
                        .ok_or(error::ErrorNotFound("Data feed with this ID not found"))
                        .expect("")
                );
            }
            {
                //negative test
                let feed_id = 1_000_000; // we consider this value is high enough for now
                let req = test::TestRequest::get()
                    .uri(format!("/get_feed_config/{feed_id}").as_str())
                    .to_request();

                // Execute the request and read the response
                let resp = test::call_service(&app, req).await;
                assert_eq!(resp.status(), 404);

                let body = to_bytes(resp.into_body()).await.unwrap();
                assert_eq!(
                    body,
                    actix_web::web::Bytes::from("Data feed with this ID not found")
                );
            }
        }

        {
            // test get_sequencer_config
            let req = test::TestRequest::get()
                .uri("/get_sequencer_config")
                .to_request();

            let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
            let sequencer_config_file = PathBuf::new()
                .join(manifest_dir)
                .join("tests")
                .join("sequencer_config.json");
            let sequencer_config = init_config::<SequencerConfig>(&sequencer_config_file)
                .expect("Failed to load config:");

            // Execute the request and read the response
            let resp = test::call_service(&app, req).await;
            assert_eq!(resp.status(), 200);

            let body = test::read_body(resp).await;
            let body_str = std::str::from_utf8(&body).expect("Failed to read body");

            let recvd_data: SequencerConfig =
                serde_json::from_str(body_str).expect("recvd_data is not valid JSON!");

            assert_eq!(recvd_data, sequencer_config);
        }
    }

    #[actix_web::test]
    async fn disable_provider_changes_sequencer_state() {
        let anvil = Anvil::new().try_spawn().unwrap();
        let key_path = get_test_private_key_path();
        let network = "ETH_disable_provider_changes_state";

        let sequencer_state = create_sequencer_state_from_sequencer_config(
            network,
            key_path.as_path(),
            anvil.endpoint().as_str(),
        )
        .await;

        let mut sequencer_config = sequencer_state.sequencer_config.write().await;
        sequencer_config.providers.insert(
            network.to_string(),
            config::Provider {
                private_key_path: "".to_string(),
                url: "".to_string(),
                contract_address: None,
                event_contract_address: None,
                transcation_timeout_secs: 42,
                data_feed_store_byte_code: None,
                data_feed_sports_byte_code: None,
                is_enabled: true,
            },
        );
        drop(sequencer_config);

        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .service(disable_provider),
        )
        .await;

        let req = test::TestRequest::post()
            .uri(format!("/disable_provider/{network}").as_str())
            .to_request();

        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        info!("{resp:?}");
        assert_eq!(200, resp.status());

        let sequencer_config = sequencer_state.sequencer_config.read().await;
        assert_eq!(
            false,
            sequencer_config.providers.get(network).unwrap().is_enabled
        );
    }

    #[actix_web::test]
    async fn enable_provider_changes_sequencer_state() {
        let anvil = Anvil::new().try_spawn().unwrap();
        let key_path = get_test_private_key_path();
        let network = "ETH_enable_provider_changes_state";

        let sequencer_state = create_sequencer_state_from_sequencer_config(
            network,
            key_path.as_path(),
            anvil.endpoint().as_str(),
        )
        .await;

        let mut sequencer_config = sequencer_state.sequencer_config.write().await;
        sequencer_config.providers.insert(
            network.to_string(),
            config::Provider {
                private_key_path: "".to_string(),
                url: "".to_string(),
                contract_address: None,
                event_contract_address: None,
                transcation_timeout_secs: 42,
                data_feed_store_byte_code: None,
                data_feed_sports_byte_code: None,
                is_enabled: false,
            },
        );
        drop(sequencer_config);

        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .service(enable_provider),
        )
        .await;

        let req = test::TestRequest::post()
            .uri(format!("/enable_provider/{network}").as_str())
            .to_request();

        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        info!("{resp:?}");
        assert_eq!(200, resp.status());

        let sequencer_config = sequencer_state.sequencer_config.read().await;
        assert_eq!(
            true,
            sequencer_config.providers.get(network).unwrap().is_enabled
        );
    }
}
