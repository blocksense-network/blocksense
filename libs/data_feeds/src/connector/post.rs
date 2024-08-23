use feed_registry::types::{DataFeedPayload, FeedResult, PayloadMetaData, Timestamp};

use crypto::deserialize_priv_key;
use crypto::sign_message;
use crypto::{JsonSerializableSignature, Signature};
use log::warn;
use sequencer_config::Reporter;
use tracing::info;

pub fn get_reporter_secret_config_file_path(secret_key_file_path: String) -> String {
    let config_file_name = "/reporter_secret_key";

    secret_key_file_path + config_file_name
}

pub fn generate_signature(
    priv_key_hex: &str,
    feed_id: &str,
    timestamp: Timestamp,
    feed_result: &FeedResult,
) -> anyhow::Result<Signature> {
    //TODO(adikov): refactor crypto lib to return proper Results, not <val, string>
    let priv_key = deserialize_priv_key(priv_key_hex).expect("Wrong key format!");

    let mut byte_buffer: Vec<u8> = feed_id
        .as_bytes()
        .iter()
        .copied()
        .chain(timestamp.to_be_bytes().to_vec())
        .collect();

    //TODO(adikov): Refactor FeedResult to be normal rust Result.
    match feed_result {
        FeedResult::Result { result } => {
            byte_buffer.extend(result.as_bytes());
        }
        FeedResult::Error { error } => {
            warn!("Error parsing recvd result of vote: {}", error);
        }
    };

    Ok(sign_message(&priv_key, &byte_buffer))
}

pub async fn post_feed_response(
    reporter: &Reporter,
    secret_key: &str,
    feed_id: u32,
    timestamp_ms: Timestamp,
    feed_result: FeedResult,
    sequencer_url: &str,
) -> anyhow::Result<String> {
    let signature = generate_signature(
        secret_key,
        format!("{}", feed_id).as_str(),
        timestamp_ms,
        &feed_result,
    )?;

    let payload_json = DataFeedPayload {
        payload_metadata: PayloadMetaData {
            reporter_id: (reporter.id as u64),
            feed_id: feed_id.to_string(),
            timestamp: timestamp_ms,
            signature: JsonSerializableSignature { sig: signature },
        },
        result: feed_result,
    };

    info!("\nPayload: {:?}", payload_json);

    let feed_url = sequencer_url.to_string() + "/post_report";

    // Comment out if you want to test API availability & aggregation
    let client = reqwest::Client::new();
    let res = client.post(feed_url).json(&payload_json).send().await?;

    Ok(res.text().await?)
}

pub async fn post_feed_response_batch(
    reporter: &Reporter,
    secret_key: &str,
    feed_api_name: &str,
    timestamp_ms: Timestamp,
    feed_result: Vec<FeedResult>,
    sequencer_url: &str,
) -> anyhow::Result<String> {
    todo!()
}
