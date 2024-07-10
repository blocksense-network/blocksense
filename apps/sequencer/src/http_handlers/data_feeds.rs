use super::super::utils::time_utils::get_ms_since_epoch;
use eyre::Result;

use super::super::feeds::feeds_registry::{get_feed_id, ReportRelevance};
use super::super::feeds::feeds_state::FeedsState;
use actix_web::web;
use actix_web::{error, Error};
use actix_web::{post, HttpResponse};
use futures::StreamExt;

use tracing::{debug, trace, warn};

use crate::inc_reporter_metric;
use crate::inc_reporter_vec_metric;
use data_feeds::types::FeedType;
use serde_json::from_value;

const MAX_SIZE: usize = 262_144; // max payload size is 256k

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

    let reporter_id = match v["reporter_id"].to_string().parse::<u64>() {
        Ok(x) => x,
        Err(_) => {
            return Ok(HttpResponse::BadRequest().into());
        }
    };

    let feed_id;
    let reporter = {
        let reporters = app_state.reporters.read().unwrap();
        let reporter = reporters.get_key_value(&reporter_id);
        match reporter {
            Some(x) => {
                let reporter = x.1;
                feed_id = match get_feed_id(v["feed_id"].to_string().as_str()) {
                    Some(f) => f,
                    None => {
                        inc_reporter_metric!(reporter, votes_for_nonexistent_feed);
                        return Ok(HttpResponse::NotFound().into());
                    }
                };
                //TODO: Check signature of vote!
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

    let result: FeedType = match from_value(v["result"].clone()) {
        Ok(x) => x,
        Err(_) => {
            inc_reporter_metric!(reporter, unrecognized_result_format);
            return Ok(HttpResponse::BadRequest().into());
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
