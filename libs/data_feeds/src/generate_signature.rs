use crypto::{deserialize_priv_key, sign_message, Signature};
use feed_registry::types::{FeedResult, Timestamp};

pub fn serialize_reporter_vote(
    feed_id: &str,
    timestamp: Timestamp,
    result: &FeedResult,
) -> Vec<u8> {
    let feed_value_bytes = result
        .as_ref()
        .map(|value| value.as_bytes(18, timestamp as u64))
        .unwrap_or_default();

    [
        feed_id.as_bytes(),
        &timestamp.to_be_bytes(),
        &feed_value_bytes,
    ]
    .concat()
}

pub fn generate_signature(
    priv_key_hex: &str,
    feed_id: &str,
    timestamp: Timestamp,
    feed_result: &FeedResult,
) -> anyhow::Result<Signature> {
    //TODO(adikov): refactor crypto lib to return proper Results, not <val, string>
    let priv_key = deserialize_priv_key(priv_key_hex).expect("Wrong key format!");

    // TODO(xearty): this case should be revisited. I am not convinced this should happen at this
    // level. If error is a valid answer to the feed, then we should serialize the error as well
    let _ = feed_result
        .as_ref()
        .inspect_err(|err| log::warn!("Error parsing recvd result of vote: {}", err));

    let serialized_vote = serialize_reporter_vote(feed_id, timestamp, feed_result);

    Ok(sign_message(&priv_key, &serialized_vote))
}
