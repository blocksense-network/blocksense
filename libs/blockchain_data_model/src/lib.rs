pub mod in_mem_db;

use anyhow::Result;
use blocksense_utils::{EncodedFeedId, FeedId};
use ssz_rs::prelude::*;

pub const DATA_CHUNK_SIZE: usize = 32;
pub const KEY_CHUNK_SIZE: usize = 32;
type HashType = [u8; DATA_CHUNK_SIZE];
pub type FeedIdChunk = [u8; KEY_CHUNK_SIZE];
pub type DataChunk = [u8; DATA_CHUNK_SIZE];
pub type Resources = [Option<DataChunk>; DATA_CHUNK_SIZE];

#[derive(Debug, PartialEq, SimpleSerialize, Default, Clone)]
pub struct AssetPair {
    pub base: DataChunk,
    pub quote: DataChunk,
}

#[derive(Debug, PartialEq, SimpleSerialize, Default, Clone)]
pub struct BlockFeedConfig {
    pub id: FeedId,
    pub name: DataChunk,
    pub full_name: DataChunk,
    pub description: DataChunk,
    pub _type: DataChunk,
    pub decimals: u8,
    pub pair: AssetPair,
    pub report_interval_ms: u64,
    pub first_report_start_time: u64,
    pub resources: Resources,
    pub quorum_percentage: [u8; 4], // The percentage of votes needed to aggregate and post result to contract.
    pub skip_publish_if_less_then_percentage: [u8; 4],
    pub always_publish_heartbeat_ms: Option<u128>,
    pub script: DataChunk,
    pub value_type: DataChunk,
    pub aggregate_type: DataChunk,
    pub stride: u8,
}

#[derive(Debug, PartialEq, SimpleSerialize, Default, Clone)]
pub struct AssetFeedUpdate {
    id: FeedIdChunk,
    feed_data: DataChunk,
}

pub type FeedUpdatesChunk = [Option<AssetFeedUpdate>; 32];
pub type FeedUpdatesInBlock = [FeedUpdatesChunk; 16];

#[derive(Debug, PartialEq, SimpleSerialize, Default, Clone)]
pub struct BlockHeader {
    pub issuer_id: u64,
    pub block_height: u64,
    pub timestamp: u64,
    pub prev_block_hash: HashType,
    pub add_remove_feeds_merkle_root: HashType,
}

impl BlockHeader {
    pub fn serialize(&mut self) -> Result<Vec<u8>> {
        let result = ssz_rs::serialize(self)?;
        Ok(result)
    }

    pub fn deserialize(serialized: &[u8]) -> Result<BlockHeader> {
        let result = ssz_rs::deserialize(serialized)?;
        Ok(result)
    }
}

#[derive(Debug, PartialEq, SimpleSerialize, Default, Clone)]
pub struct FeedActions {
    pub block_height: u64,
    pub new_feeds: [Option<BlockFeedConfig>; MAX_NEW_FEEDS_IN_BLOCK],
    pub feed_ids_to_rm: [Option<EncodedFeedId>; MAX_FEED_ID_TO_DELETE_IN_BLOCK],
}

impl FeedActions {
    pub fn serialize(&mut self) -> Result<Vec<u8>> {
        let result = ssz_rs::serialize(self)?;
        Ok(result)
    }

    pub fn deserialize(serialized: &[u8]) -> Result<FeedActions> {
        let result = ssz_rs::deserialize(serialized)?;
        Ok(result)
    }
}

pub const MAX_ASSET_FEED_UPDATES_IN_BLOCK: usize =
    std::mem::size_of::<FeedUpdatesInBlock>() / std::mem::size_of::<Option<AssetFeedUpdate>>();

pub const MAX_NEW_FEEDS_IN_BLOCK: usize = 32;
pub const MAX_FEED_ID_TO_DELETE_IN_BLOCK: usize = 32;
