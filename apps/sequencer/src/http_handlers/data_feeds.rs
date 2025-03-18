use actix_web::http::StatusCode;
use alloy_primitives::{FixedBytes, PrimitiveSignature};
use chrono::{TimeZone, Utc};
use eyre::Result;
use gnosis_safe::utils::SignatureWithAddress;
use std::str::FromStr;
use std::sync::Arc;
use utils::time::current_unix_time;

use actix_web::error::{ErrorBadRequest, ErrorInternalServerError};
use actix_web::web::{self, ServiceConfig};
use actix_web::Error;
use actix_web::{get, post, HttpResponse};
use feed_registry::types::{GetLastPublishedRequestData, LastPublishedValue, ReportRelevance};
use futures::StreamExt;
use serde::{Deserialize, Serialize};

use tracing::{debug, error, info, info_span, trace, warn};
use uuid::Uuid;

use crate::feeds::feed_slots_processor::FeedSlotsProcessor;
use crate::http_handlers::MAX_SIZE;
use crate::sequencer_state::SequencerState;
use config::SequencerConfig;
use feed_registry::registry::FeedAggregateHistory;
use feed_registry::types::DataFeedPayload;
use feed_registry::types::FeedMetaData;
use feeds_processing::utils::check_signature;
use gnosis_safe::data_types::ReporterResponse;
use prometheus::{inc_metric, inc_vec_metric};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{mpsc, RwLock};
use tokio::time::Duration;

fn get_max_buffer_size(cfg: &SequencerConfig) -> usize {
    if let Some(size) = cfg.http_input_buffer_size {
        size
    } else {
        MAX_SIZE
    }
}

async fn process_report(
    sequencer_state: &web::Data<SequencerState>,
    data_feed: DataFeedPayload,
) -> HttpResponse {
    let reporter_id = data_feed.payload_metadata.reporter_id;
    let signature = &data_feed.payload_metadata.signature;
    let msg_timestamp = data_feed.payload_metadata.timestamp;

    let feed_id: u32;
    let reporter = {
        let reporters = sequencer_state.reporters.read().await;
        let reporter = reporters.get_key_value(&reporter_id);
        match reporter {
            Some(x) => {
                let reporter = x.1;
                let reporter_metrics = reporter.read().await.reporter_metrics.clone();
                feed_id = match data_feed.payload_metadata.feed_id.parse::<u32>() {
                    Ok(val) => val,
                    Err(e) => {
                        inc_metric!(reporter_metrics, reporter_id, non_valid_feed_id_reports);
                        debug!("Error parsing input's feed_id: {}", e);
                        return HttpResponse::BadRequest().into();
                    }
                };
                {
                    let rlocked_reporter = reporter.read().await;
                    if !check_signature(
                        &signature.sig,
                        &rlocked_reporter.pub_key,
                        data_feed.payload_metadata.feed_id.as_str(),
                        msg_timestamp,
                        &data_feed.result,
                    ) {
                        drop(rlocked_reporter);
                        warn!(
                            "Signature check failed for feed_id: {} from reporter_id: {}",
                            feed_id, reporter_id
                        );
                        inc_metric!(reporter_metrics, reporter_id, non_valid_signature);
                        return HttpResponse::Unauthorized().into();
                    }
                }
                reporter.clone()
            }
            None => {
                warn!(
                    "Recvd vote from reporter with unregistered ID = {}!",
                    reporter_id
                );
                return HttpResponse::Unauthorized().into();
            }
        }
    };
    let reporter_metrics = reporter.read().await.reporter_metrics.clone();

    match &data_feed.result {
        Ok(result) => {
            debug!(
                "Recvd result from reporter[{}]: {:?} for feed_id {}",
                reporter_id, result, feed_id
            );
        }
        Err(error) => {
            warn!(
                "Reported error from reporter[{}]: {} for feed_id {}",
                reporter_id, error, feed_id
            );
            inc_metric!(reporter_metrics, reporter_id, errors_reported_for_feed);
        }
    };

    trace!(
        "data_feed = {:?}; feed_id = {:?}; reporter_id = {:?}",
        data_feed,
        feed_id,
        reporter_id
    );
    let feed = {
        let reg = sequencer_state.registry.read().await;
        debug!("getting feed_id = {}", &feed_id);
        match reg.get(feed_id) {
            Some(x) => x,
            None => {
                drop(reg);
                inc_metric!(reporter_metrics, reporter_id, non_valid_feed_id_reports);
                return HttpResponse::BadRequest().into();
            }
        }
    };

    let current_time_as_ms = current_unix_time();

    // check if the time stamp in the msg is <= current_time_as_ms
    // and check if it is inside the current active slot frame.
    let report_relevance = {
        let feed = feed.read().await;
        feed.check_report_relevance(current_time_as_ms, msg_timestamp)
    };

    match report_relevance {
        ReportRelevance::Relevant => {
            let mut reports = sequencer_state.reports.write().await;
            if reports.push(feed_id, reporter_id, data_feed).await {
                debug!(
                    "Recvd timely vote (result/error) from reporter_id = {} for feed_id = {}",
                    reporter_id, feed_id
                );
                inc_vec_metric!(
                    reporter_metrics,
                    reporter_id,
                    timely_reports_per_feed,
                    feed_id
                );
            } else {
                debug!(
                    "Recvd revote from reporter_id = {} for feed_id = {}",
                    reporter_id, feed_id
                );
                inc_vec_metric!(
                    reporter_metrics,
                    reporter_id,
                    total_revotes_for_same_slot_per_feed,
                    feed_id
                );
            }
            return HttpResponse::Ok().into(); // <- send response
        }
        ReportRelevance::NonRelevantOld => {
            debug!(
                "Recvd late vote from reporter_id = {} for feed_id = {}",
                reporter_id, feed_id
            );
            inc_vec_metric!(
                reporter_metrics,
                reporter_id,
                late_reports_per_feed,
                feed_id
            );
        }
        ReportRelevance::NonRelevantInFuture => {
            debug!(
                "Recvd vote for future slot from reporter_id = {} for feed_id = {}",
                reporter_id, feed_id
            );
            inc_vec_metric!(
                reporter_metrics,
                reporter_id,
                in_future_reports_per_feed,
                feed_id
            );
        }
    }
    HttpResponse::BadRequest().into()
}

#[post("/post_report")]
pub async fn post_report(
    mut payload: web::Payload,
    sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    let max_size = get_max_buffer_size(&*sequencer_state.sequencer_config.read().await);
    let mut body = web::BytesMut::new();
    while let Some(chunk) = payload.next().await {
        let chunk = chunk?;
        // limit max size of in-memory payload
        if (body.len() + chunk.len()) > max_size {
            return Err(ErrorBadRequest("overflow"));
        }
        body.extend_from_slice(&chunk);
    }

    // body is loaded, now we can deserialize serde-json
    // let obj = serde_json::from_slice::<MyObj>(&body)?;
    debug!("body = {:?}!", body);

    let v: serde_json::Value = serde_json::from_str(std::str::from_utf8(&body)?)?;
    let data_feed: DataFeedPayload = serde_json::from_value(v)?;

    Ok(process_report(&sequencer_state, data_feed).await)
}

#[get("/get_last_published_value_and_time")]
pub async fn get_last_published_value_and_time(
    payload: web::Payload,
    sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    let max_size = get_max_buffer_size(&*sequencer_state.sequencer_config.read().await);

    let span = info_span!("get_last_published_value_and_time");
    let _guard = span.enter();

    let requested_data_feeds: Vec<GetLastPublishedRequestData> =
        deserialize_payload_to_vec::<GetLastPublishedRequestData>(payload, max_size).await?;
    let history = sequencer_state.feed_aggregate_history.read().await;
    let mut results: Vec<LastPublishedValue> = vec![];
    for r in requested_data_feeds {
        let v = match r.feed_id.parse::<u32>() {
            Ok(feed_id) => {
                if history.is_registered_feed(feed_id) {
                    if let Some(last) = history.last(feed_id) {
                        LastPublishedValue {
                            feed_id: r.feed_id.clone(),
                            value: Some(last.value.clone()),
                            timeslot_end: last.end_slot_timestamp,
                            error: None,
                        }
                    } else {
                        LastPublishedValue {
                            feed_id: r.feed_id.clone(),
                            value: None,
                            timeslot_end: 0,
                            error: None,
                        }
                    }
                } else {
                    LastPublishedValue {
                        feed_id: r.feed_id.clone(),
                        value: None,
                        timeslot_end: 0,
                        error: Some("Feed is not registered".to_string()),
                    }
                }
            }
            Err(e) => LastPublishedValue {
                feed_id: r.feed_id.clone(),
                value: None,
                timeslot_end: 0,
                error: Some(format!("{e}")),
            },
        };
        results.push(v);
    }
    Ok(HttpResponse::Ok().json(results))
}

use serde::de::DeserializeOwned;

async fn deserialize_payload_to_vec<T>(
    mut payload: web::Payload,
    max_size: usize,
) -> Result<Vec<T>, Error>
where
    T: DeserializeOwned,
{
    let mut body = web::BytesMut::new();
    while let Some(chunk) = payload.next().await {
        let chunk = chunk?;
        // limit max size of in-memory payload
        if (body.len() + chunk.len()) > max_size {
            return Err(ErrorBadRequest("overflow"));
        }
        body.extend_from_slice(&chunk);
    }

    // body is loaded, now we can deserialize serde-json
    // let obj = serde_json::from_slice::<MyObj>(&body)?;
    debug!("body = {body:?}!");

    let v: serde_json::Value = serde_json::from_str(std::str::from_utf8(&body)?)?;
    let vec_t: Vec<T> = serde_json::from_value(v)?;
    Ok(vec_t)
}

#[post("/post_reports_batch")]
pub async fn post_reports_batch(
    payload: web::Payload,
    sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    let max_size = get_max_buffer_size(&*sequencer_state.sequencer_config.read().await);

    let span = info_span!("post_reports_batch");
    let _guard = span.enter();

    let data_feeds: Vec<DataFeedPayload> =
        deserialize_payload_to_vec::<DataFeedPayload>(payload, max_size).await?;
    info!("Received batches {}", data_feeds.len());

    let mut errors_in_batch = Vec::new();
    for data_feed in data_feeds {
        let res = process_report(&sequencer_state, data_feed).await;
        if res.status() != StatusCode::OK || res.error().is_some() {
            errors_in_batch.push(format!("{res:?}"));
        }
    }

    if errors_in_batch.is_empty() {
        Ok(HttpResponse::Ok().into())
    } else {
        Ok(HttpResponse::BadRequest().body(format!("{errors_in_batch:?}")))
    }
}

#[post("/post_aggregated_consensus_vote")]
pub async fn post_aggregated_consensus_vote(
    mut payload: web::Payload,
    sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    let max_size = get_max_buffer_size(&*sequencer_state.sequencer_config.read().await);

    let span = info_span!("post_aggregated_consensus_vote");
    let _guard = span.enter();

    let mut body = web::BytesMut::new();
    while let Some(chunk) = payload.next().await {
        let chunk = chunk?;
        // limit max size of in-memory payload
        if (body.len() + chunk.len()) > max_size {
            return Err(ErrorBadRequest("overflow"));
        }
        body.extend_from_slice(&chunk);
    }

    info!("Recvd aggregated_consensus_vote = {body:?}!");

    let v: serde_json::Value = serde_json::from_str(std::str::from_utf8(&body)?)?;
    let reporter_response: ReporterResponse = serde_json::from_value(v)?;

    let reporter_id = reporter_response.reporter_id;
    let network = reporter_response.network.as_str();

    let provider_metrics = {
        let providers = sequencer_state.providers.read().await;
        match providers.get(network) {
            Some(provider) => provider.lock().await.provider_metrics.clone(),
            None => {
                error!("Trying to get the prometheus metrics of a non existent network!");
                return Ok(HttpResponse::BadRequest().body("Unknown Network".to_string()));
            }
        }
    };

    let (signature, signer_address) = {
        let reporters = sequencer_state.reporters.read().await;
        let reporter = reporters.get(&reporter_id).cloned();
        drop(reporters);

        let Some(reporter) = reporter else {
            warn!("Unknown Reporter sending aggregation batch signature {body:?}!");
            return Ok(HttpResponse::BadRequest().body("Unknown Reporter".to_string()));
        };
        let signature = match PrimitiveSignature::from_str(reporter_response.signature.as_str()) {
            Ok(r) => r,
            Err(e) => {
                inc_vec_metric!(
                    provider_metrics,
                    network,
                    total_corrupt_aggregates_signatures_recvd,
                    reporter_id
                );
                return Ok(HttpResponse::BadRequest()
                    .body(format!("Could not deserialize signature: {e}")));
            }
        };

        let signer_address = reporter.read().await.address;
        let call_data_with_signatures = sequencer_state
            .batches_awaiting_consensus
            .read()
            .await
            .get_batch_waiting_signatures(
                reporter_response.block_height,
                reporter_response.network.as_str(),
            );

        let tx_hash_str = match call_data_with_signatures {
            Some(v) => v.tx_hash,
            None => {
                inc_vec_metric!(
                    provider_metrics,
                    network,
                    total_non_expected_signed_aggregates_revcd,
                    reporter_id
                );
                return Ok(HttpResponse::BadRequest().body(format!(
                    "No calldata waiting for signatires for block height {} and network {}",
                    reporter_response.block_height,
                    reporter_response.network.as_str(),
                )));
            }
        };
        let tx_hash = match FixedBytes::<32>::from_str(tx_hash_str.as_str()) {
            Ok(v) => v,
            Err(e) => {
                inc_vec_metric!(
                    provider_metrics,
                    network,
                    total_corrupt_aggregates_tx_data_recvd,
                    reporter_id
                );
                return Ok(HttpResponse::BadRequest().body(format!(
                    "failed to deserialize tx_data for block height {} and network {}: {}",
                    reporter_response.block_height,
                    reporter_response.network.as_str(),
                    e,
                )));
            }
        };

        let recovered_address = signature.recover_address_from_prehash(&tx_hash).unwrap();
        if signer_address != recovered_address {
            inc_vec_metric!(
                provider_metrics,
                network,
                total_signed_aggregates_with_incorrect_signatures_revcd,
                reporter_id
            );
            return Ok(HttpResponse::BadRequest().body(format!(
                "Signature check failure! Expected signer_address: {signer_address} != recovered_address: {recovered_address}"
            )));
        }

        (signature, signer_address)
    };

    match sequencer_state.aggregate_batch_sig_send.send((
        reporter_response,
        SignatureWithAddress {
            signature,
            signer_address,
        },
    )) {
        Ok(_) => Ok(HttpResponse::Ok().into()),
        Err(e) => Ok(HttpResponse::BadRequest().body(format!(
            "Error forwarding reporter aggregated consensus vote {e}"
        ))),
    }
}

#[derive(Serialize, Deserialize)]
struct RegisterFeedRequest {
    name: String,
    schema_id: String,
    num_slots: u8, // Number of solidity slots needed for this schema
    repeatability: String,
    quorum_percentage: f32,
    voting_start_time: u128, // Milliseconds since EPOCH
    voting_end_time: u128,   // Milliseconds since EPOCH
}

#[derive(Serialize, Deserialize)]
struct RegisterFeedResponse {
    feed_id: String,
}

#[post("/feed/register")]
pub async fn register_feed(
    register_request: web::Json<RegisterFeedRequest>,
    sequencer_state: web::Data<SequencerState>,
) -> Result<HttpResponse, Error> {
    // STEP 1 - Read request
    let name = register_request.name.clone();
    let schema_id = register_request.schema_id.clone();
    let num_slots = register_request.num_slots;
    let repeatability = register_request.repeatability.clone();
    let quorum_percentage = register_request.quorum_percentage; //TODO: reconsider what impact this field will have on one-shot feeds
    let voting_start_time_ms: u128 = register_request.voting_start_time;
    let voting_end_time_ms: u128 = register_request.voting_end_time;

    // STEP 2 - Validate request
    // Validate schema_id is valid UUID
    let schema_id = Uuid::parse_str(&schema_id).map_err(|e| ErrorBadRequest(e.to_string()))?;

    // TODO: Schema id and number of solidity slots needed for the schema are passed as request params.
    // Once a schema service is up and running we'll check the schema exists and extract the number of slots from there.

    // Validate repeatability
    if repeatability != "event_feed" {
        return Err(ErrorBadRequest("Invalid repeatability"));
    }

    // Validate voting_start_time and voting_end_time are in the future and start < end
    let current_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis();

    if voting_start_time_ms <= current_time {
        return Err(ErrorBadRequest("voting_start_time must be in the future"));
    }

    if voting_end_time_ms <= current_time {
        return Err(ErrorBadRequest("voting_end_time must be in the future"));
    }

    if voting_start_time_ms >= voting_end_time_ms {
        return Err(ErrorBadRequest(
            "voting_start_time must be less than voting_end_time",
        ));
    }

    // STEP 3 - Update Sequencer registers

    // get valid id
    // update data feed registry
    let voting_start_system_time = UNIX_EPOCH + Duration::from_millis(voting_start_time_ms as u64);
    let report_interval_ms = voting_end_time_ms - voting_start_time_ms;
    let new_feed_metadata = FeedMetaData::new_oneshot(
        name.clone(),
        report_interval_ms as u64,
        quorum_percentage,
        voting_start_system_time,
    );
    let voting_start_timestamp = match Utc
        .timestamp_millis_opt(voting_start_time_ms as i64)
        .single()
    {
        Some(v) => v,
        _ => {
            return Err(ErrorBadRequest("voting_start_time parsing error"));
        }
    };
    let voting_end_timestamp = match Utc.timestamp_millis_opt(voting_end_time_ms as i64).single() {
        Some(v) => v,
        _ => {
            return Err(ErrorBadRequest("voting_end_time_ms parsing error"));
        }
    };

    let feed_id = {
        let mut allocator = sequencer_state.feed_id_allocator.write().await;
        match allocator.as_mut() {
            Some(a) => {
                match a.allocate(
                    num_slots,
                    schema_id,
                    voting_start_timestamp,
                    voting_end_timestamp,
                ) {
                    Ok(feed_id) => feed_id,
                    Err(e) => {
                        return Err(ErrorInternalServerError(format!(
                            "Error when allocating feed_id {e}"
                        )));
                    }
                }
            }
            None => {
                return Err(ErrorInternalServerError(
                    "Error when allocating feed_id".to_string(),
                ));
            }
        }
    };

    // Check FeedMetaDataRegistry does not already have element with feed_id. Should never happen
    sequencer_state
        .registry
        .write()
        .await
        .push(feed_id, new_feed_metadata);

    let registered_feed_metadata = match sequencer_state.registry.read().await.get(feed_id) {
        Some(x) => x,
        None => {
            return Err(ErrorInternalServerError(format!(
                "Error when reading from feed registry for feed_id={feed_id}"
            )));
        }
    };

    // update feeds slots processor
    let feed_aggregate_history: Arc<RwLock<FeedAggregateHistory>> =
        Arc::new(RwLock::new(FeedAggregateHistory::new()));

    let feed_slots_processor = FeedSlotsProcessor::new(name, feed_id);
    let (cmd_send, cmd_recv) = mpsc::unbounded_channel();

    if let Err(err) = tokio::task::Builder::new()
        .name(format!("manual_feed_processor_{feed_id}").as_str())
        .spawn_local(async move {
            feed_slots_processor
                .start_loop(
                    &sequencer_state,
                    &registered_feed_metadata,
                    &feed_aggregate_history,
                    None,
                    cmd_recv,
                    Some(cmd_send),
                )
                .await
        })
    {
        error!("Failed to spawn manual processor for feed {feed_id} due to {err}!");
    }
    // STEP 4 - Prep response
    let response = RegisterFeedResponse {
        feed_id: feed_id.to_string(),
    };
    Ok(HttpResponse::Ok().json(response))
}

pub fn add_main_services(cfg: &mut ServiceConfig) {
    cfg.service(post_report)
        .service(post_reports_batch)
        .service(get_last_published_value_and_time)
        .service(post_aggregated_consensus_vote);
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::feeds::feed_workers::prepare_app_workers;
    use crate::http_handlers::admin::deploy;
    use crate::providers::provider::init_shared_rpc_providers;
    use actix_web::{test, App};
    use alloy::node_bindings::Anvil;
    use alloy::primitives::Address;
    use config::AllFeedsConfig;
    use config::{get_test_config_with_no_providers, test_feed_config};

    use crate::sequencer_state::create_sequencer_state_from_sequencer_config;
    use config::{get_test_config_with_single_provider, SequencerConfig};
    use crypto::JsonSerializableSignature;
    use data_feeds::generate_signature::generate_signature;
    use feed_registry::types::{DataFeedPayload, FeedType, PayloadMetaData};
    use regex::Regex;
    use std::collections::HashMap;
    use std::path::PathBuf;
    use std::str::FromStr;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use tokio::sync::mpsc;
    use utils::logging::init_shared_logging_handle;

    #[actix_web::test]
    async fn post_report_from_unknown_reporter_fails_with_401() {
        let log_handle = init_shared_logging_handle("INFO", false);
        let metrics_prefix = Some("post_report_from_unknown_reporter_fails_with_401_");

        let sequencer_config: SequencerConfig = get_test_config_with_no_providers();
        let feed_1_config = test_feed_config(1, 0);
        let feeds_config = AllFeedsConfig {
            feeds: vec![feed_1_config],
        };
        let providers =
            init_shared_rpc_providers(&sequencer_config, metrics_prefix, &feeds_config).await;
        let (vote_send, mut _vote_recv) = mpsc::unbounded_channel();
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
                .configure(add_main_services),
        )
        .await;

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("System clock set before EPOCH")
            .as_millis();

        const FEED_ID: &str = "1";
        const SECRET_KEY: &str = "536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003";
        const REPORT_VAL: f64 = 80000.8;
        let result = Ok(FeedType::Numerical(REPORT_VAL));
        let signature = generate_signature(SECRET_KEY, FEED_ID, timestamp, &result);

        let payload = DataFeedPayload {
            payload_metadata: PayloadMetaData {
                reporter_id: 0,
                feed_id: FEED_ID.to_string(),
                timestamp,
                signature: JsonSerializableSignature {
                    sig: signature.unwrap(),
                },
            },
            result,
        };

        let serialized_payload = match serde_json::to_value(&payload) {
            Ok(payload) => payload,
            Err(_) => panic!("Failed serialization of payload!"),
        };

        let payload_as_string = serialized_payload.to_string();

        let req = test::TestRequest::post()
            .uri("/post_report")
            .set_payload(payload_as_string)
            .to_request();

        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 401);
    }

    #[actix_web::test]
    async fn test_register_feed_success() {
        // Test that registering a oneshot feed and reporting a vote will lead
        // to a transaction write in the smart contract
        const HTTP_STATUS_SUCCESS: u16 = 200;

        let anvil = Anvil::new().try_spawn().unwrap();
        let key_path = PathBuf::from("/tmp").join("priv_key_test");
        let network = "ETH140";

        // Read app config
        let cfg = get_test_config_with_single_provider(
            network,
            key_path.as_path(),
            anvil.endpoint().as_str(),
        );
        let feeds_config = AllFeedsConfig { feeds: vec![] };

        // Create app state
        let (
            sequencer_state,
            aggregated_votes_to_block_creator_recv,
            feeds_management_cmd_to_block_creator_recv,
            feeds_slots_manager_cmd_recv,
            aggregate_batch_sig_recv,
        ) = create_sequencer_state_from_sequencer_config(
            cfg.clone(),
            "test_register_feed_success",
            feeds_config,
        )
        .await;

        // Prepare the workers outside of the spawned task
        let collected_futures = prepare_app_workers(
            sequencer_state.clone(),
            &cfg,
            aggregated_votes_to_block_creator_recv,
            feeds_management_cmd_to_block_creator_recv,
            feeds_slots_manager_cmd_recv,
            aggregate_batch_sig_recv,
        )
        .await;

        // Start the async block in a separate task
        let _handle = tokio::spawn(async move {
            let result = futures::future::join_all(collected_futures).await;
            for v in result {
                match v {
                    Ok(res) => match res {
                        Ok(x) => x,
                        Err(e) => {
                            panic!("TaskError: {}", e);
                        }
                    },
                    Err(e) => {
                        panic!("JoinError: {} ", e);
                    }
                }
            }
        });

        // Initialize the service
        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .service(register_feed)
                .service(deploy)
                .service(post_report),
        )
        .await;

        // Deploy event_feed contract
        let req = test::TestRequest::get()
            .uri(&format!("/deploy/{}/event_feed", network))
            .to_request();

        let resp = test::call_service(&app, req).await;
        {
            // Assert contract is deployed

            fn extract_eth_address(message: &str) -> Option<String> {
                let re = Regex::new(r"0x[a-fA-F0-9]{40}").expect("Invalid regex");
                if let Some(mat) = re.find(message) {
                    return Some(mat.as_str().to_string());
                }
                None
            }

            assert_eq!(resp.status(), HTTP_STATUS_SUCCESS);
            let body = test::read_body(resp).await;
            let body_str = std::str::from_utf8(&body).expect("Failed to read body");
            let contract_address = extract_eth_address(body_str).unwrap();
            assert_eq!(body_str.len(), 66);

            // Assert we can read bytecode from that address
            let extracted_address = Address::from_str(&contract_address).ok().unwrap();
            let provider = sequencer_state
                .providers
                .read()
                .await
                .get(network)
                .unwrap()
                .clone();
            let can_get_bytecode = provider
                .lock()
                .await
                .can_read_contract_bytecode(&extracted_address, Duration::from_secs(1))
                .await
                .expect("Timeout when trying to read from address");
            assert!(can_get_bytecode);
        }

        // Construct the request payload
        let register_request = RegisterFeedRequest {
            name: "TestFeed".to_string(),
            schema_id: "de82dccb-953f-4e48-b830-71b820347b12".to_string(),
            num_slots: 2_u8,
            repeatability: "event_feed".to_string(),
            quorum_percentage: 0 as f32,
            voting_start_time: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("Time went backwards")
                .as_millis()
                + 60000, // 1 minute in the future
            voting_end_time: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("Time went backwards")
                .as_millis()
                + 120000, // 2 minutes in the future
        };

        // Send the request
        let req = test::TestRequest::post()
            .uri("/feed/register")
            .set_json(&register_request)
            .to_request();

        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), HTTP_STATUS_SUCCESS);

        // Implement and endpoint that gets the data feeds after some timestamp
        // Call it and check feed has been added

        // Post a report for the datafeed

        /////////////////////////////////////////////////////////////////////
        // BIG STEP TWO - Prepare sample report and send it to /post_report
        /////////////////////////////////////////////////////////////////////

        // Updates for Oneshot
        let slot1 =
            String::from("0404040404040404040404040404040404040404040404040404040404040404");
        let slot2 =
            String::from("0505050505050505050505050505050505050505050505050505050505050505");
        let value1 = format!("{:04x}{}{}", 0x0002, slot1, slot2);
        let mut updates_oneshot: HashMap<String, String> = HashMap::new();
        updates_oneshot.insert(String::from("00000003"), value1);

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("System clock set before EPOCH")
            .as_millis();

        const FEED_ID: &str = "1";
        const SECRET_KEY: &str = "536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003";
        const REPORT_VAL: f64 = 80000.8;
        let result = Ok(FeedType::Numerical(REPORT_VAL));
        let signature = generate_signature(SECRET_KEY, FEED_ID, timestamp, &result);

        let payload = DataFeedPayload {
            payload_metadata: PayloadMetaData {
                reporter_id: 0,
                feed_id: FEED_ID.to_string(),
                timestamp,
                signature: JsonSerializableSignature {
                    sig: signature.unwrap(),
                },
            },
            result,
        };

        let serialized_payload = match serde_json::to_value(&payload) {
            Ok(payload) => payload,
            Err(_) => panic!("Failed serialization of payload!"),
        };

        let payload_as_string = serialized_payload.to_string();

        let req = test::TestRequest::post()
            .uri("/post_report")
            .set_payload(payload_as_string)
            .to_request();

        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 401);

        /////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////////////////////////////////

        // sleep a little bit
        tokio::time::sleep(Duration::from_millis(2000)).await;
        // Use contract_address and assert a transaction was written there
        // sleep a little bit
        tokio::time::sleep(Duration::from_millis(2000)).await;
        // Assert feed is no longer in registry (was removed after vote)
    }

    #[actix_web::test]
    async fn test_get_last_published_value_and_timestamp_empty_success() {
        let sequencer_config = get_test_config_with_no_providers();
        let feed_config = AllFeedsConfig { feeds: vec![] };

        let (sequencer_state, _, _, _, _) = create_sequencer_state_from_sequencer_config(
            sequencer_config,
            "test_get_last_published_value_and_timestamp_empty_success",
            feed_config,
        )
        .await;

        // Initialize the service
        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .configure(add_main_services),
        )
        .await;

        let get_last_published_value_and_time_request: Vec<GetLastPublishedRequestData> = vec![];

        // Send the request
        let req = test::TestRequest::get()
            .uri("/get_last_published_value_and_time")
            .set_json(&get_last_published_value_and_time_request)
            .to_request();

        const HTTP_STATUS_SUCCESS: u16 = 200;
        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), HTTP_STATUS_SUCCESS);
    }

    #[actix_web::test]
    async fn test_get_last_published_value_and_timestamp_wrong_feed_id() {
        let sequencer_config = get_test_config_with_no_providers();
        let feed_config = AllFeedsConfig { feeds: vec![] };
        let (sequencer_state, _, _, _, _) = create_sequencer_state_from_sequencer_config(
            sequencer_config,
            "test_get_last_published_value_and_timestamp_wrong_feed_id",
            feed_config,
        )
        .await;

        // Initialize the service
        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .configure(add_main_services),
        )
        .await;

        let get_last_published_value_and_time_request: Vec<GetLastPublishedRequestData> =
            vec![GetLastPublishedRequestData {
                feed_id: "wrong_id".to_string(),
            }];

        // Send the request
        let req = test::TestRequest::get()
            .uri("/get_last_published_value_and_time")
            .set_json(&get_last_published_value_and_time_request)
            .to_request();

        const HTTP_STATUS_SUCCESS: u16 = 200;
        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), HTTP_STATUS_SUCCESS);
        let body_bytes = test::read_body(resp).await;
        let v: serde_json::Value = serde_json::from_str(
            std::str::from_utf8(&body_bytes).expect("response body is not valid utf8"),
        )
        .expect("Response is not a valid json");
        let last_values: Vec<LastPublishedValue> =
            serde_json::from_value(v).expect("Can't parse repsonse");
        assert_eq!(last_values.len(), 1);
        assert_eq!(last_values[0].feed_id, "wrong_id".to_string());
        assert_eq!(last_values[0].value, None);
        assert!(last_values[0].error.is_some())
    }

    #[actix_web::test]
    async fn test_get_last_published_value_and_timestamp_unregistered_feed_id() {
        let sequencer_config = get_test_config_with_no_providers();
        let feed_config = AllFeedsConfig { feeds: vec![] };
        let (sequencer_state, _, _, _, _) = create_sequencer_state_from_sequencer_config(
            sequencer_config,
            "test_get_last_published_value_and_timestamp_unregistered_feed_id",
            feed_config,
        )
        .await;

        // Initialize the service
        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .configure(add_main_services),
        )
        .await;

        let get_last_published_value_and_time_request: Vec<GetLastPublishedRequestData> =
            vec![GetLastPublishedRequestData {
                feed_id: "1".to_string(),
            }];

        // Send the request
        let req = test::TestRequest::get()
            .uri("/get_last_published_value_and_time")
            .set_json(&get_last_published_value_and_time_request)
            .to_request();

        const HTTP_STATUS_SUCCESS: u16 = 200;
        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), HTTP_STATUS_SUCCESS);
        let body_bytes = test::read_body(resp).await;
        let v: serde_json::Value = serde_json::from_str(
            std::str::from_utf8(&body_bytes).expect("response body is not valid utf8"),
        )
        .expect("Response is not a valid json");
        let last_values: Vec<LastPublishedValue> =
            serde_json::from_value(v).expect("Can't parse repsonse");
        assert_eq!(last_values.len(), 1);
        assert_eq!(last_values[0].feed_id, "1".to_string());
        assert_eq!(last_values[0].value, None);
        // TODO, maybe we can expect error, that the feed is not registered !?
        assert!(last_values[0].error.is_some());
        assert_eq!(
            last_values[0].error,
            Some("Feed is not registered".to_string())
        );
    }

    #[actix_web::test]
    async fn test_get_last_published_value_and_timestamp_registered_feed_id_no_data() {
        let sequencer_config = get_test_config_with_no_providers();
        let all_feeds_config = AllFeedsConfig {
            feeds: vec![test_feed_config(1, 0)],
        };

        let (sequencer_state, _, _, _, _) = create_sequencer_state_from_sequencer_config(
            sequencer_config,
            "test_get_last_published_value_and_timestamp_registered_feed_id_no_data",
            all_feeds_config,
        )
        .await;
        {
            let mut history = sequencer_state.feed_aggregate_history.write().await;
            history.register_feed(1, 100);
        }

        // Initialize the service
        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .configure(add_main_services),
        )
        .await;

        let get_last_published_value_and_time_request: Vec<GetLastPublishedRequestData> =
            vec![GetLastPublishedRequestData {
                feed_id: "1".to_string(),
            }];

        // Send the request
        let req = test::TestRequest::get()
            .uri("/get_last_published_value_and_time")
            .set_json(&get_last_published_value_and_time_request)
            .to_request();

        const HTTP_STATUS_SUCCESS: u16 = 200;
        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), HTTP_STATUS_SUCCESS);
        let body_bytes = test::read_body(resp).await;
        let v: serde_json::Value = serde_json::from_str(
            std::str::from_utf8(&body_bytes).expect("response body is not valid utf8"),
        )
        .expect("Response is not a valid json");
        let last_values: Vec<LastPublishedValue> =
            serde_json::from_value(v).expect("Can't parse repsonse");
        assert_eq!(last_values.len(), 1);
        assert_eq!(last_values[0].feed_id, "1".to_string());
        assert_eq!(last_values[0].value, None);
        assert!(last_values[0].error.is_none())
    }

    #[actix_web::test]
    async fn test_get_last_published_value_and_timestamp_registered_feed_id_with_data() {
        let sequencer_config = get_test_config_with_no_providers();

        let first_report_start_time = UNIX_EPOCH + Duration::from_secs(1524885322);
        let all_feeds_config = AllFeedsConfig {
            feeds: vec![test_feed_config(1, 0)],
        };

        let (sequencer_state, _, _, _, _) = create_sequencer_state_from_sequencer_config(
            sequencer_config,
            "test_get_last_published_value_and_timestamp_registered_feed_id_with_data",
            all_feeds_config,
        )
        .await;
        {
            let mut history = sequencer_state.feed_aggregate_history.write().await;
            let feed_id = 1_u32;
            history.register_feed(feed_id, 100);
            let feed_value = FeedType::Numerical(102754.0f64);
            let end_slot_timestamp = first_report_start_time
                .duration_since(UNIX_EPOCH)
                .expect("Unknown error")
                .as_millis()
                + 300_u128 * 10_u128;
            history.push_next(feed_id, feed_value, end_slot_timestamp);
        }

        // Initialize the service
        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .configure(add_main_services),
        )
        .await;

        let get_last_published_value_and_time_request: Vec<GetLastPublishedRequestData> =
            vec![GetLastPublishedRequestData {
                feed_id: "1".to_string(),
            }];

        // Send the request
        let req = test::TestRequest::get()
            .uri("/get_last_published_value_and_time")
            .set_json(&get_last_published_value_and_time_request)
            .to_request();

        const HTTP_STATUS_SUCCESS: u16 = 200;
        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), HTTP_STATUS_SUCCESS);
        let body_bytes = test::read_body(resp).await;
        let v: serde_json::Value = serde_json::from_str(
            std::str::from_utf8(&body_bytes).expect("response body is not valid utf8"),
        )
        .expect("Response is not a valid json");
        let last_values: Vec<LastPublishedValue> =
            serde_json::from_value(v).expect("Can't parse repsonse");
        assert_eq!(last_values.len(), 1);
        assert_eq!(last_values[0].feed_id, "1".to_string());
        assert_eq!(last_values[0].value, Some(FeedType::Numerical(102754.0)));
        assert_eq!(last_values[0].timeslot_end, 1524885325000);
        assert!(last_values[0].error.is_none())
    }

    #[actix_web::test]
    async fn test_get_last_published_value_and_timestamp_registered_feed_id_with_more_data() {
        let sequencer_config = get_test_config_with_no_providers();

        let first_report_start_time = UNIX_EPOCH + Duration::from_secs(1524885322);
        let all_feeds_config = AllFeedsConfig {
            feeds: vec![test_feed_config(1, 0)],
        };

        let (sequencer_state, _, _, _, _) = create_sequencer_state_from_sequencer_config(
            sequencer_config,
            "test_get_last_published_value_and_timestamp_registered_feed_id_with_more_data",
            all_feeds_config,
        )
        .await;
        let end_slot_timestamp = first_report_start_time
            .duration_since(UNIX_EPOCH)
            .expect("Unknown error")
            .as_millis()
            + 300_u128 * 10_u128;
        {
            let mut history = sequencer_state.feed_aggregate_history.write().await;
            let feed_id = 1_u32;
            history.register_feed(feed_id, 3);

            history.push_next(
                feed_id,
                FeedType::Numerical(102754.2f64),
                end_slot_timestamp, /* + 300_u128 * 0*/
            );
            history.push_next(
                feed_id,
                FeedType::Numerical(122756.7f64),
                end_slot_timestamp + 300_u128, /* * 1*/
            );
            history.push_next(
                feed_id,
                FeedType::Numerical(102753.0f64),
                end_slot_timestamp + 300_u128 * 2,
            );
            history.push_next(
                feed_id,
                FeedType::Numerical(102244.3f64),
                end_slot_timestamp + 300_u128 * 3,
            );
            history.push_next(
                feed_id,
                FeedType::Numerical(112754.2f64),
                end_slot_timestamp + 300_u128 * 4,
            );
        }

        // Initialize the service
        let app = test::init_service(
            App::new()
                .app_data(sequencer_state.clone())
                .configure(add_main_services),
        )
        .await;

        let get_last_published_value_and_time_request: Vec<GetLastPublishedRequestData> =
            vec![GetLastPublishedRequestData {
                feed_id: "1".to_string(),
            }];

        // Send the request
        let req = test::TestRequest::get()
            .uri("/get_last_published_value_and_time")
            .set_json(&get_last_published_value_and_time_request)
            .to_request();

        const HTTP_STATUS_SUCCESS: u16 = 200;
        // Execute the request and read the response
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), HTTP_STATUS_SUCCESS);
        let body_bytes = test::read_body(resp).await;
        let v: serde_json::Value = serde_json::from_str(
            std::str::from_utf8(&body_bytes).expect("response body is not valid utf8"),
        )
        .expect("Response is not a valid json");
        let last_values: Vec<LastPublishedValue> =
            serde_json::from_value(v).expect("Can't parse repsonse");
        assert_eq!(last_values.len(), 1);
        assert_eq!(last_values[0].feed_id, "1".to_string());
        assert_eq!(last_values[0].value, Some(FeedType::Numerical(112754.2f64)));
        assert_eq!(
            last_values[0].timeslot_end,
            end_slot_timestamp + 300_u128 * 4
        );
        assert!(last_values[0].error.is_none())
    }
}
