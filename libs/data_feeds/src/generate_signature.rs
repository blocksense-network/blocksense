use blocksense_crypto::{deserialize_priv_key, sign_message, Signature};
use blocksense_feed_registry::types::{FeedResult, Timestamp};

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
            let value_bytes_result = result.as_bytes(18, timestamp as u64);
            match value_bytes_result {
                Ok(bytes) => byte_buffer.extend(bytes),
                Err(error) => {
                    log::warn!("Error converting to bytes recvd result of vote: {error}")
                }
            }
        }
        Err(error) => {
            log::warn!("Error parsing recvd result of vote: {error}");
        }
    };

    Ok(sign_message(&priv_key, &byte_buffer))
}
