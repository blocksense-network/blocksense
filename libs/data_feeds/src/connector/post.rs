use std::{
    cell::RefCell,
    io::{stdout, Write},
    rc::Rc,
};

use crate::interfaces::data_feed::DataFeed;

use feed_registry::types::{DataFeedPayload, FeedResult, PayloadMetaData, Timestamp};

use crypto::deserialize_priv_key;
use crypto::sign_message;
use crypto::{JsonSerializableSignature, Signature};
use curl::easy::Easy;
use log::warn;
use sequencer_config::Reporter;
use serde_json::Value;
use tracing::{debug, info};

fn handle_feed_response(
    reporter_id: u32,
    feed_id: String,
    timestamp: Timestamp,
    result: FeedResult,
    signature: Signature,
) -> Value {
    let payload = DataFeedPayload {
        payload_metadata: PayloadMetaData {
            reporter_id: (reporter_id as u64),
            feed_id,
            timestamp,
            signature: JsonSerializableSignature { sig: signature },
        },
        result,
    };
    let serialized_payload = serde_json::to_value(&payload);

    match serialized_payload {
        Ok(payload) => payload,
        Err(_) => panic!("Failed serialization of payload!"), //TODO(snikolov): Handle without panic
    }
}

pub fn get_reporter_secret_config_file_path(secret_key_file_path: String) -> String {
    let config_file_name = "/reporter_secret_key";

    secret_key_file_path + config_file_name
}

pub fn generate_signature(
    priv_key_hex: &str,
    feed_id: &str,
    timestamp: Timestamp,
    feed_result: &FeedResult,
) -> Signature {
    let priv_key = deserialize_priv_key(priv_key_hex).expect("Wrong key format! ");

    let mut byte_buffer: Vec<u8> = feed_id
        .as_bytes()
        .iter()
        .copied()
        .chain(timestamp.to_be_bytes().to_vec())
        .collect();

    match feed_result {
        FeedResult::Result { result } => {
            byte_buffer.extend(result.as_bytes());
        }
        FeedResult::Error { error } => {
            warn!("Error parsing recvd result of vote: {}", error);
        }
    };
    sign_message(&priv_key, &byte_buffer)
}

pub fn post_feed_response(
    reporter: &Reporter,
    secret_key: &str,
    data_feed: Rc<RefCell<dyn DataFeed>>,
    feed_id: u32,
    asset: &str,
    sequencer_url: &str,
) {
    let (result, timestamp) = data_feed.borrow_mut().poll(asset);

    let signature = generate_signature(
        secret_key,
        format!("{}", feed_id).as_str(),
        timestamp,
        &result,
    );

    let payload_json = handle_feed_response(
        reporter.id,
        feed_id.to_string(),
        timestamp,
        result,
        signature,
    );

    info!("\nPayload: {:?}", payload_json);

    let feed_url = sequencer_url.to_string() + "/post_report";

    // Comment out if you want to test API availability & aggregation
    post_request(&feed_url, payload_json);
}

pub fn post_request(url: &str, payload_json: Value) {
    let mut easy = Easy::new();

    debug!("Posting to: {}", url);
    if let Err(e) = easy.url(url) {
        panic!("Failed to set URL: {}", e);
    }

    if let Err(e) = easy.post(true) {
        panic!("Failed enabling post: {}", e);
    }

    easy.post_fields_copy(payload_json.to_string().as_bytes())
        .unwrap();

    if let Err(e) =
        easy.write_function(|data| Ok(stdout().write(data).expect("Failed to read from STDOUT!")))
    {
        panic!("Could not write response from server: {}", e);
    }

    if let Err(e) = easy.perform() {
        panic!("Could not perform POST request: {}", e);
    }
}
