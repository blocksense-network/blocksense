use super::super::utils::time_utils::get_ms_since_epoch;
use crypto::PublicKey;
use eyre::Result;

use super::super::feeds::feeds_registry::ReportRelevance;
use super::super::feeds::feeds_state::FeedsState;
use actix_web::web;
use actix_web::{error, Error};
use actix_web::{post, HttpResponse};
use futures::StreamExt;

use tracing::{debug, info, trace, warn};

use crate::inc_reporter_metric;
use crate::inc_reporter_vec_metric;
use crypto::verify_signature;
use crypto::Signature;
use data_feeds::types::Timestamp;
use data_feeds::types::{DataFeedPayload, FeedResult};

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
                feed_id = match data_feed.payload_metadata.feed_id.parse::<u32>() {
                    Ok(val) => val,
                    Err(e) => {
                        inc_reporter_metric!(reporter, non_valid_feed_id_reports);
                        debug!("Error parsing input's feed_id: {}", e);
                        return Ok(HttpResponse::BadRequest().into());
                    }
                };
                {
                    let reporter = reporter.read().expect("Could not acquire reporter lock!");
                    if check_signature(
                        &signature.sig,
                        &reporter.pub_key,
                        data_feed.payload_metadata.feed_id.as_str(),
                        msg_timestamp,
                        &data_feed.result,
                    ) == false
                    {
                        warn!(
                            "Signature check failed for feed_id: {} from reporter_id: {}",
                            feed_id, reporter_id
                        );
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

    let result = match data_feed.result {
        FeedResult::Result { result } => result,
        FeedResult::Error { error } => {
            info!("Error parsing recvd result of vote: {}", error);
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
            if reports.push(feed_id, reporter_id, result) {
                debug!(
                    "Recvd timely vote from reporter_id = {} for feed_id = {}",
                    reporter_id, feed_id
                );
                inc_reporter_vec_metric!(reporter, timely_reports_per_feed, feed_id);
            } else {
                debug!(
                    "Recvd revote from reporter_id = {} for feed_id = {}",
                    reporter_id, feed_id
                );
                inc_reporter_vec_metric!(reporter, total_revotes_for_same_slot_per_feed, feed_id);
            }
            return Ok(HttpResponse::Ok().into()); // <- send response
        }
        ReportRelevance::NonRelevantOld => {
            debug!(
                "Recvd late vote from reporter_id = {} for feed_id = {}",
                reporter_id, feed_id
            );
            inc_reporter_vec_metric!(reporter, late_reports_per_feed, feed_id);
        }
        ReportRelevance::NonRelevantInFuture => {
            debug!(
                "Recvd vote for future slot from reporter_id = {} for feed_id = {}",
                reporter_id, feed_id
            );
            inc_reporter_vec_metric!(reporter, in_future_reports_per_feed, feed_id);
        }
    }
    Ok(HttpResponse::BadRequest().into())
}
