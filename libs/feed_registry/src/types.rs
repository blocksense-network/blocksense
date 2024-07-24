use serde::{Deserialize, Serialize};
use std::fmt::{self, Display};
use thiserror::Error;

use crypto::JsonSerializableSignature;

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub enum FeedType {
    Numerical(f64),
    Text(String),
}

impl FeedType {
    pub fn sizeof(&self) -> usize {
        match self {
            FeedType::Numerical(_) => std::mem::size_of::<f64>(),
            FeedType::Text(s) => s.len(),
        }
    }

    pub fn as_bytes(&self) -> Vec<u8> {
        match self {
            FeedType::Numerical(val) => val.to_be_bytes().to_vec(),
            FeedType::Text(s) => s.as_bytes().to_vec(),
        }
    }

    pub fn to_string(&self) -> String {
        match self {
            FeedType::Numerical(val) => format!("{}", val),
            FeedType::Text(s) => s.clone(),
        }
    }

    pub fn from_bytes(bytes: Vec<u8>, variant: FeedType) -> Result<FeedType, String> {
        match variant {
            FeedType::Numerical(_) => {
                if bytes.len() < 8 {
                    return Err("Bytes len less than required!".to_string());
                }
                let arr: [u8; 8] = bytes[..8]
                    .try_into()
                    .map_err(|_| "Failed to convert to array".to_string())?;
                let val = f64::from_be_bytes(arr);
                Ok(FeedType::Numerical(val))
            }
            FeedType::Text(_) => {
                let s =
                    String::from_utf8(bytes).map_err(|_| "Invalid UTF-8 sequence".to_string())?;
                Ok(FeedType::Text(s))
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum DataFeedAPI {
    EmptyAPI,
    YahooFinanceDataFeed,
    CoinMarketCapDataFeed,
    // OpenWeather,
}

pub type Timestamp = u128;

#[derive(Debug, Serialize)]
pub struct Bytes32(pub [u8; 32]);

impl Display for Bytes32 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self.0)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct DataFeedPayload {
    /// Data feed metadata
    pub payload_metadata: PayloadMetaData,

    /// Data feed result
    pub result: FeedResult,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(untagged)]
pub enum FeedResult {
    Result { result: FeedType },
    Error { error: FeedError },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PayloadMetaData {
    /// reported id
    pub reporter_id: u64,
    /// data feed id
    pub feed_id: String,
    /// timestamp from when the data feed was gathered
    pub timestamp: Timestamp,
    /// signature of feed_id + timestamp + result
    pub signature: JsonSerializableSignature,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PostRegisterOracle {
    #[serde(default)]
    pub name: u64,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub data_feeds: Vec<DataFeed>,
    #[serde(default)]
    pub oracle_script_wasm: String,
}

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
pub enum FeedError {
    #[error("API error ocurred: {0}")]
    APIError(String),

    #[error("Undefined error ocurred")]
    UndefinedError,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct DataFeed {
    #[serde(default)]
    pub name: u64,
    #[serde(default)]
    pub namespace: u64,
}
