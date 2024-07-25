use crypto::PublicKey;
use super::super::utils::time_utils::get_ms_since_epoch;
use chrono::{TimeZone, Utc};
use eyre::Result;
use utils::time::current_unix_time;
use std::sync::{Arc, RwLock};

use super::super::feeds::feeds_state::FeedsState;
use actix_web::web;
use actix_web::{error, Error};
use actix_web::{post, HttpResponse};
use feed_registry::types::ReportRelevance;
use futures::StreamExt;
use serde::{Deserialize, Serialize};

use tracing::{debug, info, trace, warn};
use uuid::Uuid;

use crate::feeds::feed_slots_processor::feed_slots_processor_loop;
use crate::feeds::feeds_registry::{FeedAggregateHistory, FeedMetaData};
use crypto::verify_signature;
use crypto::Signature;
use feed_registry::types::{DataFeedPayload, FeedResult, Timestamp};
use prometheus::{inc_metric, inc_vec_metric};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::time::Duration;

const MAX_SIZE: usize = 262_144; // max payload size is 256k

pub fn check_signature(
    signature: &Signature,
    pub_key: &PublicKey,
    feed_id: &str,
    timestamp: Timestamp,
    feed_result: &FeedResult,
) -> bool {
    let mut byte_buffer: Vec<u8> = feed_id
        .as_bytes()
        .to_vec()
        .into_iter()
        .chain((timestamp as u128).to_be_bytes().to_vec())
        .collect();

    match feed_result {
        FeedResult::Result { result } => {
            byte_buffer.extend(result.as_bytes());
        }
        FeedResult::Error { error } => {
            warn!("Reported error for feed_id {} : {}", feed_id, error);
        }
    };
    verify_signature(&pub_key, &signature, &byte_buffer)
}

#[post("/post_report")]
pub async fn post_report(
    mut payload: web::Payload,
    app_state: web::Data<FeedsState>,
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

    // body is loaded, now we can deserialize serde-json
    // let obj = serde_json::from_slice::<MyObj>(&body)?;
    debug!("body = {:?}!", body);

    let v: serde_json::Value = serde_json::from_str(std::str::from_utf8(&body)?)?;
    let data_feed: DataFeedPayload = serde_json::from_value(v)?;

    let reporter_id = data_feed.payload_metadata.reporter_id;
    let signature = data_feed.payload_metadata.signature;
    let msg_timestamp = data_feed.payload_metadata.timestamp;

    let feed_id: u32;
    let reporter = {
        let reporters = app_state.reporters.read().unwrap();
        let reporter = reporters.get_key_value(&reporter_id);
        match reporter {
            Some(x) => {
                let reporter = x.1;
                let reporter_metrics = reporter.read().unwrap().reporter_metrics.clone();
                feed_id = match data_feed.payload_metadata.feed_id.parse::<u32>() {
                    Ok(val) => val,
                    Err(e) => {
                        inc_metric!(reporter_metrics, reporter_id, non_valid_feed_id_reports);
                        debug!("Error parsing input's feed_id: {}", e);
                        return Ok(HttpResponse::BadRequest().into());
                    }
                };
                {
                    let rlocked_reporter =
                        reporter.read().expect("Could not acquire reporter lock!");
                    if check_signature(
                        &signature.sig,
                        &rlocked_reporter.pub_key,
                        data_feed.payload_metadata.feed_id.as_str(),
                        msg_timestamp,
                        &data_feed.result,
                    ) == false
                    {
                        drop(rlocked_reporter);
                        warn!(
                            "Signature check failed for feed_id: {} from reporter_id: {}",
                            feed_id, reporter_id
                        );
                        inc_metric!(reporter_metrics, reporter_id, non_valid_signature);
                        return Ok(HttpResponse::Unauthorized().into());
                    }
                }
                reporter.clone()
            }
            None => {
                warn!(
                    "Recvd vote from reporter with unregistered ID = {}!",
                    reporter_id
                );
                return Ok(HttpResponse::Unauthorized().into());
            }
        }
    };
    let reporter_metrics = reporter.read().unwrap().reporter_metrics.clone();

    let result = match data_feed.result {
        FeedResult::Result { result } => result,
        FeedResult::Error { error } => {
            info!("Error parsing recvd result of vote: {}", error);
            inc_metric!(reporter_metrics, reporter_id, errors_reported_for_feed);
            // TODO: Handle Error vote

            return Ok(HttpResponse::Ok().into());
        }
    };

    trace!(
        "result = {:?}; feed_id = {:?}; reporter_id = {:?}",
        result,
        feed_id,
        reporter_id
    );
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
                inc_metric!(reporter_metrics, reporter_id, non_valid_feed_id_reports);
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
            if reports.push(feed_id, reporter_id, result) {
                debug!(
                    "Recvd timely vote from reporter_id = {} for feed_id = {}",
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
            return Ok(HttpResponse::Ok().into()); // <- send response
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
    Ok(HttpResponse::BadRequest().into())
}

#[derive(Serialize, Deserialize)]
struct RegisterFeedRequest {
    name: String,
    schema_id: String,
    num_slots: u8, // Number of solidity slots needed for this schema
    repeatability: String,
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
    app_state: web::Data<FeedsState>,
) -> Result<HttpResponse, Error> {
    // STEP 1 - Read request
    let name = register_request.name.clone();
    let schema_id = register_request.schema_id.clone();
    let num_slots = register_request.num_slots.clone();
    let repeatability = register_request.repeatability.clone();
    let voting_start_time_ms: u128 = register_request.voting_start_time.clone();
    let voting_end_time_ms: u128 = register_request.voting_end_time.clone();

    // STEP 2 - Validate request
    // Validate schema_id is valid UUID
    let schema_id: Uuid = Uuid::parse_str(&schema_id).unwrap();
    // TODO: Schema id and number of solidity slots needed for the schema are passed as request params.
    // Once a schema service is up and running we'll check the schema exists and extract the number of slots from there.

    // Validate repeatability
    if repeatability != "event_feed" {
        return Ok(HttpResponse::BadRequest().body("Invalid repeatability"));
    }

    // Validate voting_start_time and voting_end_time are in the future and start < end
    let current_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis();

    if voting_start_time_ms <= current_time {
        return Ok(HttpResponse::BadRequest().body("voting_start_time must be in the future"));
    }

    if voting_end_time_ms <= current_time {
        return Ok(HttpResponse::BadRequest().body("voting_end_time must be in the future"));
    }

    if voting_start_time_ms >= voting_end_time_ms {
        return Ok(
            HttpResponse::BadRequest().body("voting_start_time must be less than voting_end_time")
        );
    }

    // STEP 3 - Update Sequencer registers

    // get valid id
    // update data feed registry
    let voting_start_system_time = UNIX_EPOCH + Duration::from_millis(voting_start_time_ms as u64);
    let mut report_interval_ms = voting_end_time_ms - voting_start_time_ms;
    let new_feed_metadata =
        FeedMetaData::new_oneshot(&name, report_interval_ms as u64, voting_start_system_time);
    //let voting_start_timestamp = Utc.timestamp_millis(voting_start_time_ms as i64);
    let voting_start_timestamp = Utc
        .timestamp_millis_opt(voting_start_time_ms as i64)
        .unwrap();
    //let voting_end_timestamp = Utc.timestamp_millis(voting_end_time_ms as i64);
    let voting_end_timestamp = Utc.timestamp_millis_opt(voting_end_time_ms as i64).unwrap();

    let feed_id = {
        let mut allocator = app_state.feed_id_allocator.write().unwrap();
        let feed_id_option = allocator.as_mut().unwrap().allocate(
            num_slots,
            schema_id,
            voting_start_timestamp,
            voting_end_timestamp,
        );
        feed_id_option.unwrap()
    };

    // Check FeedMetaDataRegistry does not already have element with feed_id. Should never happen
    app_state
        .registry
        .write()
        .unwrap()
        .push(feed_id, new_feed_metadata);
    let registered_feed_metadata = app_state.registry.read().unwrap().get(feed_id).unwrap();

    // update feeds slots processor
    let feed_aggregate_history: Arc<RwLock<FeedAggregateHistory>> =
        Arc::new(RwLock::new(FeedAggregateHistory::new()));

    report_interval_ms = voting_end_time_ms - voting_start_time_ms;

    actix_web::rt::spawn(async move {
        feed_slots_processor_loop(
            app_state.voting_send_channel.clone(),
            registered_feed_metadata,
            name,
            report_interval_ms as u64,
            voting_start_time_ms as u128,
            app_state.reports.clone(),
            feed_aggregate_history,
            feed_id,
        )
        .await
    });

    // STEP 4 - Prep response
    let response = RegisterFeedResponse {
        feed_id: feed_id.to_string(),
    };
    Ok(HttpResponse::Ok().json(response))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::config::init_sequencer_config;
    use crate::feeds::feed_allocator::init_concurrent_allocator;
    use crate::feeds::feed_workers::prepare_app_workers;
    use crate::feeds::feeds_registry::{new_feeds_meta_data_reg_from_config, AllFeedsReports};
    use crate::http_handlers::admin::deploy;
    use crate::providers::provider::can_read_contract_bytecode;
    use crate::providers::provider::init_shared_rpc_providers;
    use crate::reporters::reporter::init_shared_reporters;
    use actix_web::{test, App};
    use alloy::node_bindings::Anvil;
    use alloy::primitives::Address;
    use crypto::JsonSerializableSignature;
    use data_feeds::connector::post::generate_signature;
    use feed_registry::registry::{new_feeds_meta_data_reg_from_config, AllFeedsReports};
    use feed_registry::types::{DataFeedPayload, FeedResult, FeedType, PayloadMetaData};
    use data_feeds::types::{DataFeedPayload, FeedResult, FeedType, PayloadMetaData};
    use regex::Regex;
    use sequencer_config::get_test_config_with_single_provider;
    use std::collections::HashMap;
    use std::env;
    use std::path::PathBuf;
    use std::str::FromStr;
    use std::sync::{Arc, RwLock};
    use std::time::{SystemTime, UNIX_EPOCH};
    use utils::logging::init_shared_logging_handle;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use tokio::sync::mpsc;
    use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};

    #[actix_web::test]
    async fn post_report_from_unknown_reporter_fails_with_401() {
        let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
        let tests_dir_path = PathBuf::new().join(manifest_dir).join("tests");
        env::set_var("SEQUENCER_CONFIG_DIR", tests_dir_path);
        let log_handle = init_shared_logging_handle();
        let sequencer_config = init_sequencer_config();

        let providers = init_shared_rpc_providers(
            &sequencer_config,
            Some("post_report_from_unknown_reporter_fails_with_401_"),
        )
        .await;

        let (vote_send, _vote_recv): (
            UnboundedSender<(String, String)>,
            UnboundedReceiver<(String, String)>,
        ) = mpsc::unbounded_channel();
        let app_state = web::Data::new(FeedsState {
            registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_from_config(
                &sequencer_config,
            ))),
            reports: Arc::new(RwLock::new(AllFeedsReports::new())),
            providers: providers.clone(),
            log_handle,
            reporters: init_shared_reporters(
                &sequencer_config,
                Some("post_report_from_unknown_reporter_fails_with_401_"),
            ),
            feed_id_allocator: Arc::new(RwLock::new(None)),
            voting_send_channel: vote_send,
        });

        let app =
            test::init_service(App::new().app_data(app_state.clone()).service(post_report)).await;

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("System clock set before EPOCH")
            .as_millis();

        const FEED_ID: &str = "1";
        const SECRET_KEY: &str = "536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003";
        const REPORT_VAL: f64 = 80000.8;
        let result = FeedResult::Result {
            result: FeedType::Numerical(REPORT_VAL),
        };
        let signature = generate_signature(&SECRET_KEY.to_string(), FEED_ID, timestamp, &result);

        let payload = DataFeedPayload {
            payload_metadata: PayloadMetaData {
                reporter_id: 0,
                feed_id: FEED_ID.to_string(),
                timestamp,
                signature: JsonSerializableSignature { sig: signature },
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
}
