use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug, Serialize)]
pub enum FeedError {
    #[error("Reqwest error ocurred: {0}")]
    #[serde(serialize_with = "serialize_reqwest_error")]
    RequestError(#[from] reqwest::Error),

    #[error("Error ocurred - can't retrieve timestamp")]
    TimestampError,

    #[error("API error ocurred: {0}")]
    APIError(String),

    #[error("Undefined error ocurred")]
    UndefinedError,
}

fn serialize_reqwest_error<S>(err: &reqwest::Error, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&err.to_string())
}

impl FeedError {
    pub fn stringify(error: &FeedError) -> String {
        serde_json::to_string(&error).unwrap()
    }
}

#[derive(Error, Debug)]
pub enum ConversionError {
    #[error("String larger than Bytes32")]
    StringTooLong,
}
