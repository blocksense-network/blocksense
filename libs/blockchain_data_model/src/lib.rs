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
    pub cmc_id: u32,
    pub cmc_quote: DataChunk,
}

#[derive(Debug, PartialEq, SimpleSerialize, Default, Clone)]
pub struct FeedConfig {
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

#[derive(Debug, PartialEq, SimpleSerialize, Default, Clone)]
pub struct BlockHeader {
    block_height: u64,
    timestamp: u64,
    prev_block_hash: HashType,
    feed_updates_merkle_root: HashType,
    add_remove_feeds_merkle_root: AddRemoveFeeds,
}

#[derive(Debug, PartialEq, SimpleSerialize, Default)]
pub struct FeedUpdates {
    block_height: u64,
    asset_feed_updates: [FeedUpdatesChunk; 16],
}

#[derive(Debug, PartialEq, SimpleSerialize, Default, Clone)]
pub struct AddRemoveFeeds {
    block_height: u64,
    new_feeds: [Option<FeedConfig>; 32],
    feed_ids_to_rm: [Option<u32>; 32],
}
