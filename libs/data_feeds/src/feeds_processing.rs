use anyhow::anyhow;
use feed_registry::types::FeedType;
use feed_registry::types::Timestamp;
use utils::from_hex_string;
use utils::to_hex_string;

#[derive(Debug, Clone)]
pub struct VotedFeedUpdate {
    pub feed_id: u32,
    pub value: FeedType,
    pub end_slot_timestamp: Timestamp,
}

impl VotedFeedUpdate {
    pub fn encode(&self) -> (String, String) {
        (
            to_hex_string(self.feed_id.to_be_bytes().to_vec(), None),
            naive_packing(&self.value),
        )
    }

    pub fn new_decode(
        key: &str,
        value: &str,
        end_slot_timestamp: Timestamp,
        variant: FeedType, // variant is only a type placeholder.
    ) -> Result<VotedFeedUpdate, anyhow::Error> {
        let key_bytes = from_hex_string(key)?;
        let mut dst = [0u8; 4];
        dst.clone_from_slice(&key_bytes[0..4]);
        let feed_id = u32::from_be_bytes(dst);
        let value_bytes = from_hex_string(value)?;
        let value = FeedType::from_bytes(value_bytes, variant).map_err(|e| anyhow!("{e}"))?;

        Ok(VotedFeedUpdate {
            feed_id,
            value,
            end_slot_timestamp,
        })
    }
}

pub const REPORT_HEX_SIZE: usize = 64;

pub fn naive_packing(feed_result: &FeedType) -> String {
    //TODO: Return Bytes32 type
    let result_bytes = feed_result.as_bytes();
    assert!(result_bytes.len() <= 32);

    to_hex_string(result_bytes, Some(REPORT_HEX_SIZE / 2))
}

#[cfg(test)]
mod tests {
    use std::time::SystemTime;

    use feed_registry::types::FeedType;

    use super::*;
    use alloy::hex;

    #[test]
    fn test_numerical() {
        let value = 42.42;
        let hex_string = naive_packing(&FeedType::Numerical(value));

        let bytes = hex::decode(hex_string).unwrap();
        let reversed = FeedType::from_bytes(bytes, FeedType::Numerical(0.0)).unwrap();

        assert_eq!(value.to_string(), reversed.parse_to_string());
    }

    #[test]
    fn test_string() {
        let value = "blocksense"; // size is 10
        let feed_value = FeedType::Text(value.to_string());
        let hex_string = naive_packing(&feed_value);

        let bytes = hex::decode(hex_string).unwrap();
        let mut buf = [0; 10];
        buf.copy_from_slice(&bytes[..10]);
        let reversed = std::str::from_utf8(&buf).unwrap();

        assert_eq!(value, reversed);
    }

    #[test]
    fn test_voted_feed_update() {
        let end_slot_timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_millis();
        let update = VotedFeedUpdate {
            feed_id: 42_u32,
            value: FeedType::Numerical(142.0),
            end_slot_timestamp,
        };
        let (encoded_key, encoded_value) = update.encode();
        assert_eq!("0000002a", encoded_key);
        assert_eq!(
            "00000000000000000000000000000007b2a557a6d97800000000000000000000",
            encoded_value
        );

        // Send test votes
        let k1 = "ab000001";
        let v1 = "000000000000000000000000000010f0da2079987e1000000000000000000000";
        let vote_1 =
            VotedFeedUpdate::new_decode(k1, v1, end_slot_timestamp, FeedType::Numerical(0.0))
                .unwrap();
        assert_eq!(vote_1.feed_id, 2868903937_u32);
        assert_eq!(vote_1.value, FeedType::Numerical(80000.8f64));
    }
}
