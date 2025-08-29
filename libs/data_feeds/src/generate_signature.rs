use blocksense_crypto::{deserialize_priv_key, sign_message, Signature};
use blocksense_feed_registry::types::{FeedResult, FeedType, Timestamp};

pub fn generate_signature(
    priv_key_hex: &str,
    feed_id: &str,
    timestamp: Timestamp,
    feed_result: &FeedResult,
) -> anyhow::Result<Signature> {
    //TODO(adikov): refactor crypto lib to return proper Results, not <val, string>
    let priv_key = deserialize_priv_key(priv_key_hex).expect("Wrong key format!");
    println!("feed_id: {:?}", feed_id.as_bytes());

    let mut byte_buffer: Vec<u8> = feed_id
        .as_bytes()
        .iter()
        .copied()
        .chain(timestamp.to_be_bytes().to_vec())
        .collect();

    println!("byte_buffer: {:?}", byte_buffer);

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
    println!("msg: {:?}", byte_buffer);
    Ok(sign_message(&priv_key, &byte_buffer))
}
#[cfg(test)]
mod tests {
    use super::*;
    use blocksense_crypto::Signature;
    use blocksense_feed_registry::types::FeedResult;
    #[test]
    fn test_generate_signature_with_ok_feed_result() {
        const DUMMY_PRIV_KEY_HEX: &str =
            "536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003";
        let feed_id: &'static str = "32";
        let timestamp: u128 = 1755685551079;
        let feed_result = FeedResult::Ok(FeedType::Numerical(0.999345928356523));

        let sig: Result<_, _> =
            generate_signature(DUMMY_PRIV_KEY_HEX, feed_id, timestamp, &feed_result);
        match sig {
            Ok(signature) => {
                println!("SIG: {:?}", hex::encode(Signature::compress(&signature)));
            }
            Err(e) => panic!("Failed to generate signature: {}", e),
        }
    }
}
