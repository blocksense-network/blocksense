use std::{
    io::{stdout, Write},
    rc::Rc,
};

use crate::utils::generate_string_hash;
use crate::{connector::data_feed::DataFeed, types::DataFeedAPI};
use curl::easy::Easy;
use serde_json::{json, Value};

pub async fn post_api_response(
    reporter_id: &u64,
    base_url: &str,
    data_feed: Rc<dyn DataFeed>,
    asset: &str,
) {
    let (result, timestamp) = data_feed.poll(asset).await.unwrap();

    let feed_name = DataFeedAPI::feed_asset_str(data_feed.api(), &asset.to_string());
    let feed_hash = generate_string_hash(&feed_name);

    let payload_json = json!({
        "reporter_id": reporter_id,
        "feed_name": feed_name,
        "feed_id": feed_hash,
        "timestamp": timestamp,
        "result": result,
    });

    println!("Payload: {:?}", payload_json);

    // Comment out if you want to test API availability & aggregation
    let feed_url = base_url.to_string() + &"/feed/" + &feed_hash.to_string();
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
