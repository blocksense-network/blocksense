pub mod build_info;
pub mod constants;
pub mod counter_unbounded_channel;
pub mod logging;
pub mod test_env;
pub mod time;

use ssz_rs::prelude::*;

pub type FeedId = u128;
pub type Stride = u8;

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    Hash,
    PartialOrd,
    Ord,
    serde::Serialize,
    serde::Deserialize,
    SimpleSerialize,
    Default,
)]
#[repr(transparent)]
#[serde(into = "EncodedFeedIdParts", try_from = "EncodedFeedIdParts")]
/// Packed layout: [ stride:8 | feed_id:120 ]
pub struct EncodedFeedId(pub u128);

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
struct EncodedFeedIdParts {
    #[serde(default)]
    stride: Stride,
    #[serde(with = "feed_id_serde")]
    feed_id: FeedId,
}

impl EncodedFeedId {
    pub const FEED_BITS: u32 = 120;
    pub const STRIDE_BITS: u32 = 8;
    pub const FEED_MASK: u128 = (1u128 << Self::FEED_BITS) - 1;

    #[inline]
    pub fn new(feed_id: FeedId, stride: Stride) -> Self {
        assert!(
            (feed_id & !Self::FEED_MASK) == 0,
            "feed_id must fit in 120 bits (15 bytes)"
        );
        Self(Self::encode(stride, feed_id))
    }

    #[inline]
    pub fn try_new(feed_id: FeedId, stride: Stride) -> Option<Self> {
        ((feed_id & !Self::FEED_MASK) == 0).then(|| Self(Self::encode(stride, feed_id)))
    }

    /// Pack (stride, feed_id) into a single u128.
    /// Layout: [ stride:8 | feed_id:120 ]
    #[inline]
    pub fn encode(stride: Stride, feed_id: FeedId) -> u128 {
        let hi = (stride as u128) << Self::FEED_BITS;
        hi | (feed_id & Self::FEED_MASK)
    }

    /// Unpack from self.
    #[inline]
    pub fn decode(&self) -> (Stride, FeedId) {
        let stride = self.get_stride();
        let feed_id = self.get_id();
        (stride, feed_id)
    }

    #[inline]
    pub fn get_id(&self) -> FeedId {
        self.0 & Self::FEED_MASK
    }

    #[inline]
    pub fn get_stride(&self) -> Stride {
        (self.0 >> Self::FEED_BITS) as u8
    }

    /// Lowercase hex, fixed width 32 nibbles, no `0x` prefix.
    #[inline]
    pub fn to_hex(&self) -> String {
        format!("{:032x}", self.0)
    }

    /// Lowercase hex with `0x` prefix, fixed width (0x + 32 nibbles).
    #[inline]
    pub fn to_hex_prefixed(&self) -> String {
        format!("{:#034x}", self.0) // width includes "0x"
    }
}

impl TryFrom<EncodedFeedIdParts> for EncodedFeedId {
    type Error = String;

    fn try_from(parts: EncodedFeedIdParts) -> Result<Self, Self::Error> {
        EncodedFeedId::try_new(parts.feed_id, parts.stride)
            .ok_or_else(|| "feed_id must fit within 120 bits".to_string())
    }
}

impl From<EncodedFeedId> for EncodedFeedIdParts {
    fn from(value: EncodedFeedId) -> Self {
        let (stride, feed_id) = value.decode();
        Self { stride, feed_id }
    }
}

mod feed_id_serde {
    use super::*;
    use serde::{
        de::{self, Unexpected, Visitor},
        Deserializer, Serializer,
    };

    pub fn serialize<S>(feed_id: &FeedId, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        if *feed_id <= u64::MAX as u128 {
            serializer.serialize_u64(*feed_id as u64)
        } else {
            serializer.serialize_str(&feed_id.to_string())
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<FeedId, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct FeedIdVisitor;

        impl<'de> Visitor<'de> for FeedIdVisitor {
            type Value = FeedId;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("a non-negative feed_id as number or string")
            }

            fn visit_u64<E>(self, value: u64) -> Result<Self::Value, E> {
                Ok(value as u128)
            }

            fn visit_i64<E>(self, value: i64) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                if value < 0 {
                    Err(E::invalid_value(Unexpected::Signed(value), &self))
                } else {
                    Ok(value as u128)
                }
            }

            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                value
                    .parse::<FeedId>()
                    .map_err(|_| E::invalid_value(Unexpected::Str(value), &self))
            }

            fn visit_string<E>(self, value: String) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                self.visit_str(&value)
            }
        }

        deserializer.deserialize_any(FeedIdVisitor)
    }
}

/// Pretty-print as "stride:feed_id"
impl fmt::Display for EncodedFeedId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}:{}", self.get_stride(), self.get_id())
    }
}

/// Parse from "stride:feed_id"
/// Just used for testing, maybe be useful someda.
impl FromStr for EncodedFeedId {
    type Err = ParseIntError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let mut parts = s.split(':');

        let first_part = parts.next().unwrap_or("");
        let second_part = parts.next();

        let (stride, feed_id) = match second_part {
            Some(feed_id) => (first_part.parse()?, feed_id.parse()?),
            None => (0, first_part.parse()?),
        };

        debug_assert_eq!(parts.next(), None, "One `:` expected at most");

        Ok(EncodedFeedId::new(feed_id, stride))
    }
}

/// Construct from an integer `feed_id` with stride = 0.
impl From<FeedId> for EncodedFeedId {
    #[inline]
    fn from(feed_id: FeedId) -> Self {
        EncodedFeedId::new(feed_id, 0)
    }
}

/// Construct from a `u64` `feed_id` with stride = 0.
impl From<u64> for EncodedFeedId {
    #[inline]
    fn from(feed_id: u64) -> Self {
        EncodedFeedId::new(feed_id as u128, 0)
    }
}

/// Construct from a `usize` `feed_id` with stride = 0.
impl From<usize> for EncodedFeedId {
    #[inline]
    fn from(feed_id: usize) -> Self {
        EncodedFeedId::new(feed_id as u128, 0)
    }
}

/// Construct from a `u32` `feed_id` with stride = 0.
impl From<u32> for EncodedFeedId {
    #[inline]
    fn from(feed_id: u32) -> Self {
        EncodedFeedId::new(feed_id as u128, 0)
    }
}

/// Construct from a `u16` `feed_id` with stride = 0.
impl From<u16> for EncodedFeedId {
    #[inline]
    fn from(feed_id: u16) -> Self {
        EncodedFeedId::new(feed_id as u128, 0)
    }
}

/// Construct from a `u8` `feed_id` with stride = 0.
impl From<u8> for EncodedFeedId {
    #[inline]
    fn from(feed_id: u8) -> Self {
        EncodedFeedId::new(feed_id as u128, 0)
    }
}

use std::num::ParseIntError;
use std::{
    env,
    fmt::{self, Debug, Display},
    fs::File,
    hash::{DefaultHasher, Hash, Hasher},
    io::{Read, Write},
    path::{Path, PathBuf},
    str::FromStr,
};

use anyhow::{anyhow, Context, Result};

pub fn get_env_var<T>(key: &str) -> Result<T>
where
    T: FromStr,
    T::Err: Debug + Display,
{
    let value_str = env::var(key).map_err(|_| anyhow!("Environment variable '{key}' not set"))?;
    value_str
        .parse()
        .map_err(|err| anyhow!("Failed to parse environment variable '{key}': {err}"))
}

pub fn generate_string_hash(string: &str) -> u64 {
    let mut hasher = DefaultHasher::new();

    string.hash(&mut hasher);

    hasher.finish()
}

pub fn to_hex_string(mut bytes: Vec<u8>, padding_to: Option<usize>) -> String {
    //TODO(snikolov): Return Bytes32 type
    if let Some(p) = padding_to {
        bytes.resize(p, 0);
    }
    bytes
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<Vec<_>>()
        .join("")
}

pub fn from_hex_string(input: &str) -> Result<Vec<u8>> {
    hex::decode(input).context("Decoding of hex failed")
}

pub fn read_file(path: &str) -> String {
    let mut file = File::open(path).unwrap_or_else(|_| panic!("File not found in {path}"));
    let mut data = String::new();
    file.read_to_string(&mut data)
        .unwrap_or_else(|_| panic!("File {path} read failure! "));
    data
}

pub fn write_flush_file(filename: &Path, content: &String) -> Result<()> {
    let mut file = File::create(filename)?;
    file.write_all(content.as_bytes())?;
    file.flush()?;
    Ok(())
}

pub fn get_config_file_path(base_path_from_env: &str, config_file_name: &str) -> PathBuf {
    let config_file_path = env::var(base_path_from_env).unwrap_or_else(|_| {
        let conf_dir = dirs::config_dir().expect("Configuration file path not specified.");
        let conf_dir = conf_dir.join("blocksense");
        conf_dir
            .to_str()
            .expect("Configuration file path not valid.")
            .to_string()
    });
    let config_file_path: PathBuf = config_file_path.as_str().into();
    config_file_path.join(config_file_name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn from_str_parses_stride_and_feed() {
        let encoded = EncodedFeedId::from_str("5:12345").expect("valid stride:feed pair");

        assert_eq!(encoded.get_stride(), 5);
        assert_eq!(encoded.get_id(), 12345);
    }

    #[test]
    fn from_str_defaults_stride_to_zero() {
        let encoded = EncodedFeedId::from_str("987654321").expect("valid feed without stride");

        assert_eq!(encoded.get_stride(), 0);
        assert_eq!(encoded.get_id(), 987_654_321);
    }
}
