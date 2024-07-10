use utils::to_hex_string;

use crate::types::FeedType;

pub const REPORT_HEX_SIZE: usize = 64;

pub fn naive_packing(feed_result: FeedType) -> String {
    //TODO: Return Bytes32 type
    let result_bytes = feed_result.as_bytes();
    assert!(result_bytes.len() <= 32);

    to_hex_string(result_bytes, Some(REPORT_HEX_SIZE / 2))
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy::hex;

    #[test]
    fn test_numerical() {
        let value = 42.42;
        let hex_string = naive_packing(FeedType::Numerical(value));

        let bytes = hex::decode(hex_string).unwrap();
        let mut buf = [0; 8];
        buf.copy_from_slice(&bytes[..8]);
        let reversed = f64::from_be_bytes(buf);

        assert_eq!(value, reversed);
    }

    #[test]
    fn test_string() {
        let value = "blocksense"; // size is 10
        let feed_value = FeedType::Text(value.to_string());
        let hex_string = naive_packing(feed_value);

        let bytes = hex::decode(hex_string).unwrap();
        let mut buf = [0; 10];
        buf.copy_from_slice(&bytes[..10]);
        let reversed = std::str::from_utf8(&buf).unwrap();

        assert_eq!(value, reversed);
    }
}
