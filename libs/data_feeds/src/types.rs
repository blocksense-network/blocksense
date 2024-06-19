use std::fmt;

use serde::Serialize;

pub enum ConsensusMetric {
    Median,
    Mean,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum DataFeedAPI {
    EmptyAPI,
    YahooFinanceDataFeed,
    CoinMarketCapDataFeed,
    // OpenWeather,
}

pub type Timestamp = u64;

#[derive(Debug, Serialize)]
pub struct Bytes32(pub [u8; 32]);

impl fmt::Display for Bytes32 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self.0)
    }
}
