use crate::http_handlers::MAX_SIZE;
use crate::providers::provider::ProviderStatus;
use crate::sequencer_state::SequencerState;
use actix_web::http::header::ContentType;
use actix_web::web::ServiceConfig;
use actix_web::{error, Error};
use actix_web::{get, web, HttpRequest};
use actix_web::{post, HttpResponse, Responder};
use alloy::{
    hex::FromHex, network::TransactionBuilder, primitives::Bytes, providers::Provider,
    rpc::types::eth::TransactionRequest,
};

use blocksense_registry::config::{FeedConfig, OracleScript, OraclesResponse};
use config::{AllFeedsConfig, SequencerConfig};
use eyre::eyre;
use eyre::Result;
use feed_registry::feed_registration_cmds::{
    DeleteAssetFeed, FeedsManagementCmds, RegisterNewAssetFeed,
};
use futures::StreamExt;
use std::collections::{BTreeMap, HashSet};
use utils::logging::tokio_console_active;

use crate::http_handlers::data_feeds::register_feed;
use crate::providers::eth_send_utils::deploy_contract;
use crate::providers::provider::{SharedRpcProviders, PRICE_FEED_CONTRACT_NAME};
use feed_registry::types::FeedType;
use prometheus::metrics_collector::gather_and_dump_metrics;
use tokio::time::Duration;
use tracing::info_span;
use tracing::{debug, error, info};

pub async fn get_key_from_contract(
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

    let signer = &p.signer;
    let provider = &p.provider;
    let contract_address = p.get_contract_address(PRICE_FEED_CONTRACT_NAME)?;
    info!("sending data to contract_address `{contract_address}` in network `{network}`",);

    let mut selector = key;
    selector.replace_range(0..1, "8"); // 8 indicates we want to take the latest value.
                                       // key: 0x00000000
    let input =
        Bytes::from_hex(selector).map_err(|e| eyre!("Key is not valid hex string: {}", e))?;
    let tx = TransactionRequest::default()
        .to(contract_address)
        .from(signer.address())
        .with_chain_id(provider.get_chain_id().await?)
        .input(Some(input).into());

    let result = provider.call(&tx).await?;
    info!("Call result: {:?}", result);
    // TODO: get from metadata the type of the value.
    // TODO: Refector to not use dummy argument
    let return_val = match FeedType::from_bytes(result.to_vec(), FeedType::Numerical(0.0), 18) {
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
    let contact_name = &feed_type;
    match deploy_contract(&network, &sequencer_state.providers, contact_name).await {
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
    let active_feeds = sequencer_state.active_feeds.read().await;
    let mut feeds_config = AllFeedsConfig { feeds: Vec::new() };
    for (_id, feed) in active_feeds.iter() {
        feeds_config.feeds.push(feed.clone());
    }
    feeds_config.feeds.sort_by(FeedConfig::compare);
    let feeds_config_pretty = serde_json::to_string_pretty::<AllFeedsConfig>(&feeds_config)?;
    Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(feeds_config_pretty))
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

    let active_feeds = sequencer_state.active_feeds.read().await;
    let feed_config = active_feeds
        .get(&feed_id)
        .ok_or(error::ErrorNotFound("Data feed with this ID not found"))?;
    let feed_config_pretty = serde_json::to_string_pretty::<FeedConfig>(feed_config)?;

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
    let _span = info_span!("register_asset_feed");
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
    match sequencer_state
        .feeds_management_cmd_to_block_creator_send
        .send(FeedsManagementCmds::RegisterNewAssetFeed(
            RegisterNewAssetFeed {
                config: new_feed_config.clone(),
            },
        )) {
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
    let provider: &mut config::Provider = match sequencer_config.providers.get_mut(&network_name) {
        Some(v) => v,
        None => {
            return Err(error::ErrorInternalServerError(format!(
                "Network {network_name} seems to disapear. This should never happen!"
            )));
        }
    };
    provider.is_enabled = is_enabled;
    // Dropping write lock, just out of good hygiene.
    drop(sequencer_config);

    // Modify provider_status, depending on the new value of is_enabled.
    let mut provider_status = sequencer_state.provider_status.write().await;
    provider_status.entry(network_name.clone()).and_modify(|e| {
        *e = if is_enabled {
            ProviderStatus::AwaitingFirstUpdate
        } else {
            ProviderStatus::Disabled
        }
    });
    drop(provider_status);

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

#[get("/list_provider_status")]
pub async fn list_provider_status(sequencer_state: web::Data<SequencerState>) -> HttpResponse {
    let provider_status = sequencer_state.provider_status.read().await;
    let ordered: BTreeMap<&String, &ProviderStatus> = provider_status.iter().collect();
    match serde_json::to_string_pretty(&ordered) {
        Ok(serialized_list) => HttpResponse::Ok()
            .content_type(ContentType::json())
            .body(serialized_list),
        Err(err) => HttpResponse::InternalServerError()
            .content_type(ContentType::plaintext())
            .body(err.to_string()),
    }
}

#[post("/delete_asset_feed/{feed_id}")]
pub async fn delete_asset_feed(
    req: HttpRequest,
    sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    let _span = info_span!("delete_asset_feed");
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

    match sequencer_state
        .feeds_management_cmd_to_block_creator_send
        .send(FeedsManagementCmds::DeleteAssetFeed(DeleteAssetFeed {
            id: feed_id,
        })) {
        Ok(_) => {
            info!("Scheduled deletion for feed_id: {feed_id}",);
        }
        Err(e) => {
            error!(
                "Sequencer internal error, could not forward feed deletion cmd {}",
                e
            )
        }
    };

    Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(format!("{}", feed.read().await.get_report_interval_ms())))
}

#[get("/get_oracle_scripts")]
pub async fn get_oracle_scripts(
    _sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    //TODO(adikov): Remove hardcoded data when persistent storage is added
    let oracle_scripts = OraclesResponse {
        oracles: vec![
            OracleScript {
                id: "cmc".to_string(),
                name: None,
                description: None,
                oracle_script_wasm: "cmc_oracle.wasm".to_string(),
                allowed_outbound_hosts: vec!["https://pro-api.coinmarketcap.com".to_string()],
                capabilities: HashSet::from_iter(["CMC_API_KEY".to_string()]),
            },
            OracleScript {
                id: "yahoo".to_string(),
                name: None,
                description: None,
                oracle_script_wasm: "yahoo_oracle.wasm".to_string(),
                allowed_outbound_hosts: vec!["https://yfapi.net:443".to_string()],
                capabilities: HashSet::from_iter(["YAHOO_API_KEY".to_string()]),
            },
            OracleScript {
                id: "exsat".to_string(),
                name: None,
                description: None,
                oracle_script_wasm: "exsat_holdings_oracle.wasm".to_string(),
                allowed_outbound_hosts: vec![
                    "https://raw.githubusercontent.com".to_string(),
                    "https://rpc-us.exsat.network".to_string(),
                    "https://blockchain.info".to_string(),
                ],
                capabilities: HashSet::new(),
            },
            OracleScript {
                id: "gecko_terminal".to_string(),
                name: None,
                description: None,
                oracle_script_wasm: "gecko_terminal_oracle.wasm".to_string(),
                allowed_outbound_hosts: vec!["https://app.geckoterminal.com/".to_string()],
                capabilities: HashSet::new(),
            },
            OracleScript {
                id: "crypto-price-feeds".to_string(),
                name: None,
                description: None,
                oracle_script_wasm: "crypto-price-feeds.wasm".to_string(),
                allowed_outbound_hosts: vec![
                    "https://api.kraken.com".to_string(),
                    "https://api.bybit.com".to_string(),
                    "https://api.coinbase.com".to_string(),
                    "https://api.exchange.coinbase.com".to_string(),
                    "https://api1.binance.com".to_string(),
                    "https://api.kucoin.com".to_string(),
                    "https://api.mexc.com".to_string(),
                    "https://api.crypto.com".to_string(),
                    "https://api.binance.us".to_string(),
                    "https://api.gemini.com".to_string(),
                    "https://api-pub.bitfinex.com".to_string(),
                    "https://api.upbit.com".to_string(),
                    "https://api.bitget.com".to_string(),
                    "https://api.gateio.ws".to_string(),
                    "https://www.okx.com".to_string(),
                ],
                capabilities: HashSet::new(),
            },
        ],
    };

    let oracles_config_pretty = serde_json::to_string_pretty(&oracle_scripts)?;

    Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body(oracles_config_pretty.to_string()))
}

#[get("/health")]
pub async fn health(_sequencer_state: web::Data<SequencerState>) -> Result<HttpResponse, Error> {
    //TODO(adikov): Check if we have connection to:
    // * All blockchain networks
    // * Kafka
    // * ...
    Ok(HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body("".to_string()))
}

pub fn add_admin_services(cfg: &mut ServiceConfig) {
    cfg.service(get_key)
        .service(deploy)
        .service(set_log_level)
        .service(get_feed_report_interval)
        .service(register_feed)
        .service(get_feeds_config)
        .service(get_feed_config)
        .service(get_sequencer_config)
        .service(register_asset_feed)
        .service(delete_asset_feed)
        .service(disable_provider)
        .service(enable_provider)
        .service(list_provider_status)
        .service(get_oracle_scripts)
        .service(health);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::provider::init_shared_rpc_providers;
    use actix_test::to_bytes;
    use actix_web::{test, App};
    use alloy::node_bindings::Anvil;
    use config::{
        get_test_config_with_no_providers, get_test_config_with_single_provider, test_feed_config,
    };
    use config::{AllFeedsConfig, SequencerConfig};
    use regex::Regex;

    use std::path::PathBuf;
    use tokio::sync::mpsc;
    use utils::logging::init_shared_logging_handle;
    use utils::test_env::get_test_private_key_path;

    use crate::sequencer_state::create_sequencer_state_from_sequencer_config;

    #[actix_web::test]
    async fn test_get_feed_report_interval() {
        let log_handle = init_shared_logging_handle("INFO", false);
        let sequencer_config: SequencerConfig = get_test_config_with_no_providers();
        let mut feed_1_config = test_feed_config(1, 0);
        feed_1_config.schedule.interval_ms = 321868;
        let feeds_config = AllFeedsConfig {
            feeds: vec![feed_1_config],
        };

        let metrics_prefix = Some("test_get_feed_report_interval_");

        let providers =
            init_shared_rpc_providers(&sequencer_config, metrics_prefix, &feeds_config).await;

        let (vote_send, _vote_recv) = mpsc::unbounded_channel();
        let (
            feeds_management_cmd_to_block_creator_send,
            _feeds_management_cmd_to_block_creator_recv,
        ) = mpsc::unbounded_channel();
        let (feeds_slots_manager_cmd_send, _feeds_slots_manager_cmd_recv) =
            mpsc::unbounded_channel();
        let (aggregate_batch_sig_send, _aggregate_batch_sig_recv) = mpsc::unbounded_channel();

        let sequencer_state = web::Data::new(SequencerState::new(
            feeds_config,
            providers,
            log_handle,
            &sequencer_config,
            metrics_prefix,
            None,
            vote_send,
            feeds_management_cmd_to_block_creator_send,
            feeds_slots_manager_cmd_send,
            aggregate_batch_sig_send,
        ));

        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .configure(add_admin_services),
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
        assert_eq!(body_str, "321868");
    }

    #[actix_web::test]
    async fn test_deploy_endpoint_success() {
        const HTTP_STATUS_SUCCESS: u16 = 200;

        let anvil = Anvil::new().try_spawn().unwrap();
        let network = "ETH_test_deploy_endpoint_success";
        let metrics_prefix = "test_deploy_endpoint_success";
        let is_enabled = true;
        let sequencer_state = create_sequencer_state_for_provider_changes(
            network,
            metrics_prefix,
            is_enabled,
            Some(anvil.endpoint()),
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
            info!("{resp:?}");
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
    async fn test_get_feeds_config() {
        let sequencer_config = get_test_config_with_no_providers();
        let expected_sequencer_config = sequencer_config.clone();
        let mut feeds_config = AllFeedsConfig {
            feeds: vec![test_feed_config(1, 0)],
        };
        let metrics_prefix = "test_get_feeds_config";
        let (
            sequencer_state,
            _vote_recv,
            _feeds_management_cmd_to_block_creator_recv,
            _feeds_slots_manager_cmd_recv,
            _aggregate_batch_sig_recv,
        ) = create_sequencer_state_from_sequencer_config(
            sequencer_config,
            metrics_prefix,
            feeds_config.clone(),
        )
        .await;

        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .configure(add_admin_services),
        )
        .await;

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

            let mut recvd_data: AllFeedsConfig =
                serde_json::from_str(body_str).expect("recvd_data is not valid JSON!");

            recvd_data.feeds.sort_by(FeedConfig::compare);
            feeds_config.feeds.sort_by(FeedConfig::compare);

            assert_eq!(recvd_data.feeds, feeds_config.feeds);
        }

        {
            // test get_feed_config
            {
                // positive test
                let feed_id = 1;
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

            // Execute the request and read the response
            let resp = test::call_service(&app, req).await;
            assert_eq!(resp.status(), 200);

            let body = test::read_body(resp).await;
            let body_str = std::str::from_utf8(&body).expect("Failed to read body");

            let recvd_data: SequencerConfig =
                serde_json::from_str(body_str).expect("recvd_data is not valid JSON!");

            assert_eq!(recvd_data, expected_sequencer_config);
        }
    }

    async fn create_sequencer_state_for_provider_changes(
        network: &str,
        metrics_prefix: &str,
        is_enabled: bool,
        provider_url: Option<String>,
    ) -> web::Data<SequencerState> {
        let key_path = get_test_private_key_path();
        let url = provider_url.unwrap_or("http://127.0.0.1:8545".to_string());
        let mut sequencer_config =
            get_test_config_with_single_provider(network, PathBuf::new().as_path(), &url);
        sequencer_config
            .providers
            .entry(network.to_string())
            .and_modify(|provider| {
                *provider = config::Provider {
                    private_key_path: key_path.to_str().unwrap().to_owned(),
                    url,
                    contract_address: None,
                    safe_address: None,
                    safe_min_quorum: 1,
                    event_contract_address: None,
                    multicall_contract_address: None,
                    transaction_drop_timeout_secs: 42,
                    transaction_retry_timeout_secs: 20,
                    retry_fee_increment_fraction: 0.1,
                    transaction_gas_limit: 1337,
                    data_feed_store_byte_code: Some("0x60a060405234801561001057600080fd5b506040516101cf3803806101cf83398101604081905261002f91610040565b6001600160a01b0316608052610070565b60006020828403121561005257600080fd5b81516001600160a01b038116811461006957600080fd5b9392505050565b60805161014561008a6000396000609001526101456000f3fe608060405234801561001057600080fd5b50600060405160046000601c83013751905063e000000081161561008e5763e0000000198116632000000082161561005957806020526004356004603c20015460005260206000f35b805463800000008316156100775781600052806004601c2001546000525b634000000083161561008857806020525b60406000f35b7f00000000000000000000000000000000000000000000000000000000000000003381146100bb57600080fd5b631a2d80ac820361010a57423660045b8181101561010857600481601c376000516004601c2061ffff6001835408806100f2575060015b91829055600483013585179101556024016100cb565b005b600080fdfea26469706673582212204a7c38e6d9b723ea65e6d451d6a8436444c333499ad610af033e7360a2558aea64736f6c63430008180033".to_string()),
                    data_feed_sports_byte_code: Some("0x60a0604052348015600e575f80fd5b503373ffffffffffffffffffffffffffffffffffffffff1660808173ffffffffffffffffffffffffffffffffffffffff168152505060805161020e61005a5f395f60b1015261020e5ff3fe608060405234801561000f575f80fd5b5060045f601c375f5163800000008116156100ad5760043563800000001982166040517ff0000f000f00000000000000000000000000000000000000000000000000000081528160208201527ff0000f000f0000000000000001234000000000000000000000000000000000016040820152606081205f5b848110156100a5578082015460208202840152600181019050610087565b506020840282f35b505f7f000000000000000000000000000000000000000000000000000000000000000090503381146100dd575f80fd5b5f51631a2d80ac81036101d4576040513660045b818110156101d0577ff0000f000f0000000000000000000000000000000000000000000000000000008352600481603c8501377ff0000f000f000000000000000123400000000000000000000000000000000001604084015260608320600260048301607e86013760608401516006830192505f5b81811015610184576020810284013581840155600181019050610166565b50806020028301925060208360408701377fa826448a59c096f4c3cbad79d038bc4924494a46fc002d46861890ec5ac62df0604060208701a150506020810190506080830192506100f1565b5f80f35b5f80fdfea2646970667358221220b77f3ab2f01a4ba0833f1da56458253968f31db408e07a18abc96dd87a272d5964736f6c634300081a0033".to_string()),
                    is_enabled,
                    allow_feeds: None,
                    impersonated_anvil_account: None,
                    publishing_criteria: vec![],
                    contract_version: 1,
                }
            });

        let feeds_config = AllFeedsConfig {
            feeds: vec![test_feed_config(1, 0)],
        };
        //let metrics_prefix = "disable_provider_changes_sequencer_state";
        let (
            sequencer_state,
            _vote_recv,
            _feeds_management_cmd_to_block_creator_recv,
            _feeds_slots_manager_cmd_recv,
            _aggregate_batch_sig_recv,
        ) = create_sequencer_state_from_sequencer_config(
            sequencer_config,
            metrics_prefix,
            feeds_config.clone(),
        )
        .await;
        sequencer_state
    }

    #[actix_web::test]
    async fn disable_provider_changes_sequencer_state() {
        let network = "ETH_disable_provider_changes_sequencer_state";
        let metrics_prefix = "disable_provider_changes_sequencer_state";
        let is_enabled = true;
        let sequencer_state =
            create_sequencer_state_for_provider_changes(network, metrics_prefix, is_enabled, None)
                .await;
        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .configure(add_admin_services),
        )
        .await;

        {
            let sequencer_config = sequencer_state.sequencer_config.read().await;
            assert!(sequencer_config.providers.get(network).unwrap().is_enabled);
        }

        let req = test::TestRequest::post()
            .uri(format!("/disable_provider/{network}").as_str())
            .to_request();

        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        assert_eq!(200, resp.status());
        {
            let sequencer_config = sequencer_state.sequencer_config.read().await;
            assert!(!sequencer_config.providers.get(network).unwrap().is_enabled);
        }
    }

    #[actix_web::test]
    async fn enable_provider_changes_sequencer_state() {
        let network = "ETH_enable_provider_changes_sequencer_state";
        let metrics_prefix = "enable_provider_changes_sequencer_state";
        let is_enabled = false;
        let sequencer_state =
            create_sequencer_state_for_provider_changes(network, metrics_prefix, is_enabled, None)
                .await;

        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .configure(add_admin_services),
        )
        .await;

        let req = test::TestRequest::post()
            .uri(format!("/enable_provider/{network}").as_str())
            .to_request();

        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        assert_eq!(200, resp.status());

        let sequencer_config = sequencer_state.sequencer_config.read().await;
        assert!(sequencer_config.providers.get(network).unwrap().is_enabled);
    }

    #[actix_web::test]
    async fn disable_provider_changes_provider_status() {
        let network = "ETH_disable_provider_changes_provider_status";
        let metrics_prefix = "disable_provider_changes_provider_status";
        let is_enabled: bool = true;
        let sequencer_state =
            create_sequencer_state_for_provider_changes(network, metrics_prefix, is_enabled, None)
                .await;

        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .configure(add_admin_services),
        )
        .await;

        let req = test::TestRequest::post()
            .uri(format!("/disable_provider/{network}").as_str())
            .to_request();

        // Check state before request
        let provider_status = sequencer_state.provider_status.read().await;
        assert_eq!(
            &ProviderStatus::AwaitingFirstUpdate,
            provider_status.get(network).unwrap()
        );
        drop(provider_status);

        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        assert_eq!(200, resp.status());

        // Check state after request
        let provider_status = sequencer_state.provider_status.read().await;
        assert_eq!(
            &ProviderStatus::Disabled,
            provider_status.get(network).unwrap()
        );
        drop(provider_status);
    }

    #[actix_web::test]
    async fn enable_provider_changes_provider_status() {
        let network = "ETH_enable_provider_changes_provider_status";
        let metrics_prefix = "enable_provider_changes_provider_status";
        let is_enabled = false;
        let sequencer_state =
            create_sequencer_state_for_provider_changes(network, metrics_prefix, is_enabled, None)
                .await;

        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .configure(add_admin_services),
        )
        .await;

        let req = test::TestRequest::post()
            .uri(format!("/enable_provider/{network}").as_str())
            .to_request();

        // Check status before request
        let provider_status = sequencer_state.provider_status.read().await;
        assert_eq!(
            &ProviderStatus::Disabled,
            provider_status.get(network).unwrap()
        );
        drop(provider_status);

        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        assert_eq!(200, resp.status());

        // Check status before request
        let provider_status = sequencer_state.provider_status.read().await;
        assert_eq!(
            &ProviderStatus::AwaitingFirstUpdate,
            provider_status.get(network).unwrap()
        );
        drop(provider_status);
    }
}
