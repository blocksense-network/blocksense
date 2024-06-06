use std::fmt;

use serde::{Serialize, Serializer};

pub enum ConsensusMetric {
    Median,
    Mean,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum DataFeedAPI {
    EmptyAPI,
    YahooFinance,
    CoinMarketCap,
    // OpenWeather,
}

// #[derive(Debug,Serialize)]
// pub struct Payload {
//     result: Bytes32,
//     reporter_id: u64,
//     feed_id: u64,
//     timestamp: Timestamp,

//     feed_name: String,
//     api_error_bit: bool,
//     api_error_message: String
// }

pub type Timestamp = u64;

#[derive(Debug)]
pub struct Bytes32(pub [u8; 32]);

impl Serialize for Bytes32 {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bytes(&self.0)
    }
}

impl fmt::Display for Bytes32 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self.0)
    }
}
