pub mod in_mem_db;

use ssz_rs::prelude::*;

type HashType = [u8; 32];
pub type FeedIdChunk = [u8; 4];
pub type DataChunk = [u8; 32];

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
}

#[derive(Debug, PartialEq, SimpleSerialize, Default)]
pub struct FeedUpdates {
    block_height: u64,
    asset_feed_updates: [FeedUpdatesChunk; 16],
}
