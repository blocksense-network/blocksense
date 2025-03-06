use crypto::{deserialize_priv_key, sign_message, Signature};
use feed_registry::types::{FeedResult, Timestamp};

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

    match feed_result {
        Ok(result) => {
            byte_buffer.extend(result.as_bytes(18));
        }
        Err(error) => {
            log::warn!("Error parsing recvd result of vote: {}", error);
        }
    };

    Ok(sign_message(&priv_key, &byte_buffer))
}
