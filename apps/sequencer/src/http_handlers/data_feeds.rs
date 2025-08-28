use actix_web::http::StatusCode;
use alloy_primitives::{FixedBytes, Signature};
use blocksense_gnosis_safe::utils::SignatureWithAddress;
use blocksense_utils::time::current_unix_time;
use blocksense_utils::EncodedFeedId;
use eyre::Result;
use std::str::FromStr;

use actix_web::error::ErrorBadRequest;
use actix_web::web::{self, ServiceConfig};
use actix_web::Error;
use actix_web::{get, post, HttpResponse};
use blocksense_feed_registry::types::{
    GetLastPublishedRequestData, LastPublishedValue, ReportRelevance,
};
use futures::StreamExt;
use serde::{Deserialize, Serialize};

use tracing::{debug, info, info_span, warn};

use crate::http_handlers::MAX_SIZE;
use crate::sequencer_state::SequencerState;
use blocksense_config::SequencerConfig;
use blocksense_feed_registry::registry::VoteStatus;
use blocksense_feed_registry::types::DataFeedPayload;
use blocksense_feeds_processing::utils::check_signature;
use blocksense_gnosis_safe::data_types::ReporterResponse;
use blocksense_metrics::{inc_metric, inc_vec_metric};

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

    let encoded_feed_id: EncodedFeedId;
    let reporter = {
        let reporters = sequencer_state.reporters.read().await;
        let reporter = reporters.get_key_value(&reporter_id);
        match reporter {
            Some(x) => {
                let reporter = x.1;
                let reporter_metrics = reporter.read().await.reporter_metrics.clone();
                encoded_feed_id = match data_feed.payload_metadata.feed_id.parse::<EncodedFeedId>() {
                    Ok(val) => val,
                    Err(e) => {
                        inc_metric!(reporter_metrics, reporter_id, non_valid_feed_id_reports);
                        debug!("Error parsing input's feed_id: {e}");
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
                            "Signature check failed for encoded_feed_id: {} from reporter_id: {} data_feed: {:?}",
                            encoded_feed_id, reporter_id, data_feed
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
                "Recvd result from reporter[{}]: {:?} for encoded_feed_id {}",
                reporter_id, result, encoded_feed_id
            );
        }
        Err(error) => {
            warn!(
                "Reported error from reporter[{}]: {} for encoded_feed_id {}",
                reporter_id, error, encoded_feed_id
            );
            inc_metric!(reporter_metrics, reporter_id, errors_reported_for_feed);
        }
    };

    debug!("data_feed = {:?}", data_feed,);
    let feed = {
        let reg = sequencer_state.registry.read().await;
        debug!("getting encoded_feed_id = {}", &encoded_feed_id);
        match reg.get(&encoded_feed_id) {
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
    let (report_relevance, always_publish_heartbeat_ms, feed_name) = {
        let feed = feed.read().await;
        let report_relevance = feed.check_report_relevance(current_time_as_ms, msg_timestamp);
        let always_publish_heartbeat_ms = feed.always_publish_heartbeat_ms.unwrap_or(0);
        let feed_name = feed.get_name().clone();
        (report_relevance, always_publish_heartbeat_ms, feed_name)
    };

    match report_relevance {
        ReportRelevance::Relevant => {
            let mut reports = sequencer_state.reports.write().await;
            match reports.push(encoded_feed_id, reporter_id, data_feed).await {
                VoteStatus::FirstVoteForSlot => {
                    debug!(
                        "Recvd timely vote (result/error) from reporter_id = {} for encoded_feed_id = {}, feed_name = {feed_name}",
                        reporter_id, encoded_feed_id
                    );
                    inc_vec_metric!(
                        reporter_metrics,
                        timely_reports_per_feed,
                        reporter_id,
                        encoded_feed_id.to_string(),
                        feed_name,
                        always_publish_heartbeat_ms
                    );
                }
                VoteStatus::RevoteForSlot(prev_vote) => {
                    debug!(
                        "Recvd revote from reporter_id = {} for encoded_feed_id = {}, feed_name = {feed_name}, prev_vote = {:?}",
                        reporter_id, encoded_feed_id, prev_vote
                    );
                    inc_vec_metric!(
                        reporter_metrics,
                        total_revotes_for_same_slot_per_feed,
                        reporter_id,
                        encoded_feed_id.to_string(),
                        feed_name,
                        always_publish_heartbeat_ms
                    );
                }
            }
            return HttpResponse::Ok().into(); // <- send response
        }
        ReportRelevance::NonRelevantOld => {
            debug!(
                "Recvd late vote from reporter_id = {} for encoded_feed_id = {}, feed_name = {feed_name}",
                reporter_id, encoded_feed_id
            );
            inc_vec_metric!(
                reporter_metrics,
                late_reports_per_feed,
                reporter_id,
                encoded_feed_id.to_string(),
                feed_name,
                always_publish_heartbeat_ms
            );
        }
        ReportRelevance::NonRelevantInFuture => {
            debug!(
                "Recvd vote for future slot from reporter_id = {} for encoded_feed_id = {}, feed_name = {feed_name}",
                reporter_id, encoded_feed_id
            );
            inc_vec_metric!(
                reporter_metrics,
                in_future_reports_per_feed,
                reporter_id,
                encoded_feed_id.to_string(),
                feed_name,
                always_publish_heartbeat_ms
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
        let v = match r.feed_id.parse::<EncodedFeedId>() {
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

    let (signature, signer_address) = {
        let reporter_id = reporter_response.reporter_id;
        let reporters = sequencer_state.reporters.read().await;
        let reporter = reporters.get(&reporter_id).cloned();
        drop(reporters);

        let Some(reporter) = reporter else {
            warn!("Unknown Reporter sending aggregation batch signature {body:?}!");
            return Ok(HttpResponse::BadRequest().body("Unknown Reporter".to_string()));
        };
        let signature = match Signature::from_str(reporter_response.signature.as_str()) {
            Ok(r) => r,
            Err(e) => {
                return Ok(HttpResponse::BadRequest()
                    .body(format!("Could not deserialize signature: {e}")))
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

pub fn add_main_services(cfg: &mut ServiceConfig) {
    cfg.service(post_report)
        .service(post_reports_batch)
        .service(get_last_published_value_and_time)
        .service(post_aggregated_consensus_vote);
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::providers::provider::init_shared_rpc_providers;
    use actix_web::{test, App};
    use blocksense_config::AllFeedsConfig;
    use blocksense_config::{get_test_config_with_no_providers, test_feed_config};

    use crate::sequencer_state::create_sequencer_state_from_sequencer_config;
    use blocksense_config::SequencerConfig;
    use blocksense_crypto::JsonSerializableSignature;
    use blocksense_data_feeds::generate_signature::generate_signature;
    use blocksense_feed_registry::types::{DataFeedPayload, FeedType, PayloadMetaData};
    use blocksense_utils::logging::init_shared_logging_handle;
    use std::collections::HashMap;
    use std::sync::Arc;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use tokio::sync::{mpsc, RwLock};

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
            vote_send,
            feeds_management_cmd_to_block_creator_send,
            feeds_slots_manager_cmd_send,
            aggregate_batch_sig_send,
            Arc::new(RwLock::new(HashMap::new())),
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
    async fn test_get_last_published_value_and_timestamp_empty_success() {
        let sequencer_config = get_test_config_with_no_providers();
        let feed_config = AllFeedsConfig { feeds: vec![] };

        let (sequencer_state, _, _, _, _, _) = create_sequencer_state_from_sequencer_config(
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
        let (sequencer_state, _, _, _, _, _) = create_sequencer_state_from_sequencer_config(
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
        let (sequencer_state, _, _, _, _, _) = create_sequencer_state_from_sequencer_config(
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

        let (sequencer_state, _, _, _, _, _) = create_sequencer_state_from_sequencer_config(
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

        let (sequencer_state, _, _, _, _, _) = create_sequencer_state_from_sequencer_config(
            sequencer_config,
            "test_get_last_published_value_and_timestamp_registered_feed_id_with_data",
            all_feeds_config,
        )
        .await;
        {
            let mut history = sequencer_state.feed_aggregate_history.write().await;
            let feed_id = 1 as FeedId;
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

        let (sequencer_state, _, _, _, _, _) = create_sequencer_state_from_sequencer_config(
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
            let feed_id = 1 as FeedId;
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
