use std::{
    io::{stdout, Write},
    rc::Rc,
};

use curl::easy::Easy;
use serde_json::{json, Value};
use crate::connector::data_feed::DataFeed;


pub async fn post_api_response(url: &str, data_feed: Rc<dyn DataFeed>, asset: &str) {
    let (result, timestamp) = data_feed.poll(asset).await.unwrap();

    let payload_json = json!({
        "reporter_id": 0,
        "feed_id": data_feed.api().as_str().to_owned() + &'.'.to_string() + &asset.to_string().clone(),
        "timestamp": timestamp,
        "result": result,
    });

    println!("Payload: {:?}", payload_json);

    // Comment out if you want to test API availability & aggregation
    post_request(url,payload_json);
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
