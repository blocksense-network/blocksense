use std::{
    cell::RefCell,
    io::{stdout, Write},
    rc::Rc,
};

use crate::connector::{data_feed::DataFeed, error::FeedError};
use curl::easy::Easy;
use serde_json::{json, Value};
use utils::generate_string_hash;

use super::data_feed::Payload;

fn handle_feed_response(
    reporter_id: u64,
    feed_name: &String,
    feed_hash: u64,
    timestamp: u64,
    result: Result<Box<dyn Payload>, FeedError>,
) -> Value {
    match result {
        Ok(result) => {
            json!({
                "reporter_id": reporter_id,
                "feed_name": feed_name,
                "feed_id": feed_hash,
                "timestamp": timestamp,
                "result": result.as_ref().to_bytes32().unwrap(),
            })
        }
        Err(err) => {
            json!({
                "reporter_id": reporter_id,
                "feed_name": feed_name,
                "feed_id": feed_hash,
                "timestamp": timestamp,
                "api_error_message": err.to_string()

            })
        }
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

    let feed_hash = generate_string_hash(&feed_asset_name);

    let payload_json =
        handle_feed_response(reporter_id, feed_asset_name, feed_hash, timestamp, result);

    println!("\nPayload: {:?}", payload_json);

    let feed_url = base_url.to_string() + &"/feed/" + &feed_hash.to_string();

    // Comment out if you want to test API availability & aggregation
    post_request(&feed_url, payload_json);
}

pub fn post_request(url: &str, payload_json: Value) {
    let mut easy = Easy::new();
    easy.url(url).unwrap();
    easy.post(true).unwrap();

    easy.post_fields_copy(&payload_json.to_string().as_bytes())
        .unwrap();

    // Set a closure to handle the response
    easy.write_function(|data| Ok(stdout().write(data).unwrap()))
        .unwrap();

    easy.perform().unwrap();
}
