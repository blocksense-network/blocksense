pub mod in_mem_db;

use ssz_rs::prelude::*;

type HashType = [u8; 32];
pub type FeedIdChunk = [u8; 4];
pub type DataChunk = [u8; 32];

#[derive(Debug, PartialEq, SimpleSerialize, Default, Clone)]
pub struct AssetPair {
    pub base: DataChunk,
    pub quote: DataChunk,
}

#[derive(Debug, PartialEq, SimpleSerialize, Default, Clone)]
pub struct Resources {
    pub resource_keys: [Option<DataChunk>; 32],
    pub resource_values: [Option<DataChunk>; 32],
}

#[derive(Debug, PartialEq, SimpleSerialize, Default, Clone)]
pub struct BlockFeedConfig {
    pub id: u32,
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
    pub script: DataChunk,
}

#[derive(Debug, PartialEq, SimpleSerialize, Default)]
pub struct AssetFeedUpdate {
    id: FeedIdChunk,
    feed_data: DataChunk,
}

pub type FeedUpdatesChunk = [Option<AssetFeedUpdate>; 32];
pub type FeedUpdatesInBlock = [FeedUpdatesChunk; 16];

#[derive(Debug, PartialEq, SimpleSerialize, Default, Clone)]
pub struct BlockHeader {
    block_height: u64,
    timestamp: u64,
    prev_block_hash: HashType,
    add_remove_feeds_merkle_root: HashType,
}

#[derive(Debug, PartialEq, SimpleSerialize, Default, Clone)]
pub struct AddRemoveFeeds {
    block_height: u64,
    new_feeds: [Option<BlockFeedConfig>; MAX_NEW_FEEDS_IN_BLOCK],
    feed_ids_to_rm: [Option<u32>; MAX_FEED_ID_TO_DELETE_IN_BLOCK],
}

pub const MAX_ASSET_FEED_UPDATES_IN_BLOCK: usize =
    std::mem::size_of::<FeedUpdatesInBlock>() / std::mem::size_of::<Option<AssetFeedUpdate>>();

pub const MAX_NEW_FEEDS_IN_BLOCK: usize = 32;
pub const MAX_FEED_ID_TO_DELETE_IN_BLOCK: usize = 32;
