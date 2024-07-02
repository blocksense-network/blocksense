use std::{
    cell::RefCell,
    io::{stdout, Write},
    rc::Rc,
};

use crate::{
    interfaces::data_feed::DataFeed,
    types::{DataFeedPayload, FeedResult, PayloadMetaData, Timestamp},
};
use curl::easy::Easy;
use serde_json::Value;
use tracing::{debug, info};
use utils::generate_string_hash;

fn handle_feed_response(
    reporter_id: u64,
    feed_id: String,
    timestamp: Timestamp,
    result: FeedResult,
) -> Value {
    let payload = DataFeedPayload {
        payload_metadata: PayloadMetaData {
            reporter_id,
            feed_id,
            timestamp,
        },
        result,
    };
    let serialized_payload = serde_json::to_value(&payload);

    match serialized_payload {
        Ok(payload) => payload,
        Err(_) => panic!("Failed serialization of payload!"), //TODO(snikolov): Handle without panic
    }
}

pub async fn post_feed_response(
    reporter_id: u64,
    base_url: &str,
    data_feed: Rc<RefCell<dyn DataFeed>>,
    feed_asset_name: &String,
    asset: &str,
) {
    let (result, timestamp) = data_feed.borrow_mut().poll(asset).await;

    let feed_hash = generate_string_hash(feed_asset_name);

    let payload_json = handle_feed_response(reporter_id, feed_hash.to_string(), timestamp, result);

    info!("\nPayload: {:?}", payload_json);

    let feed_url = base_url.to_string() + "/feed/" + &feed_hash.to_string();

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

    if let Err(e) = easy.write_function(|data| Ok(stdout().write(data).unwrap())) {
        panic!("Could not write response from server: {}", e);
    }

    if let Err(e) = easy.perform() {
        panic!("Could not perform POST request: {}", e);
    }
}
