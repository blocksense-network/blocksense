pub mod build_info;
pub mod constants;
pub mod counter_unbounded_channel;
pub mod logging;
pub mod test_env;
pub mod time;

use ssz_rs::prelude::*;
use ssz_rs::DeserializeError;

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
pub struct EncodedFeedId {
    /// Packed layout: [ stride:8 | feed_id:120 ]
    pub data: u128,
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
        Self {
            data: Self::encode(stride, feed_id),
        }
    }

    #[inline]
    pub fn try_new(feed_id: FeedId, stride: Stride) -> Option<Self> {
        ((feed_id & !Self::FEED_MASK) == 0).then(|| Self {
            data: Self::encode(stride, feed_id),
        })
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
        self.data & Self::FEED_MASK
    }

    #[inline]
    pub fn get_stride(&self) -> Stride {
        (self.data >> Self::FEED_BITS) as u8
    }

    /// Lowercase hex, fixed width 32 nibbles, no `0x` prefix.
    #[inline]
    pub fn to_hex(&self) -> String {
        format!("{:032x}", self.data)
    }

    /// Lowercase hex with `0x` prefix, fixed width (0x + 32 nibbles).
    #[inline]
    pub fn to_hex_prefixed(&self) -> String {
        format!("{:#034x}", self.data) // width includes "0x"
    }
}

/// Pretty-print as "stride:feed_id"
impl fmt::Display for EncodedFeedId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}:{}", self.get_stride(), self.get_id())
    }
}

/// Parse from "stride:feed_id"
impl FromStr for EncodedFeedId {
    type Err = ParseIntError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let mut parts = s.split(':');
        let stride_str = parts.next().unwrap_or("");
        let feed_str = parts.next().unwrap_or("");
        // You can add extra validation: exactly 2 parts, etc.
        let stride: u8 = stride_str.parse()?;
        let feed_id: u128 = feed_str.parse()?;
        Ok(EncodedFeedId::new(feed_id, stride))
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
