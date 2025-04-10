use crate::{
    BlockFeedConfig, BlockHeader, FeedActions, HashType, MAX_FEED_ID_TO_DELETE_IN_BLOCK,
    MAX_NEW_FEEDS_IN_BLOCK,
};
use anyhow::Result;
use blocksense_utils::time::current_unix_time;
use hex::FromHex;
use hex_literal::hex;
use ssz_rs::{Node, SimpleSerialize};
use std::collections::HashMap;
use tracing::error;

const GENESIS_HASH: HashType =
    hex!("ec59d3d7860eadc9207b6ccf7c897b23b6b8e82d3d4b80212dfebc15a6b16b17");

pub struct InMemDb {
    latest_block_height: u64,
    block_height_to_header_hash: HashMap<u64, HashType>,
    block_header_hash_to_header: HashMap<HashType, BlockHeader>,
    // The feeds that will be registered after this block is applied to the state + the feed ID-s that will be deleted. The key is the Merkle root of the structure, which is in the block header.
    add_remove_feeds: HashMap<HashType, FeedActions>,
}

impl InMemDb {
    pub fn new() -> InMemDb {
        InMemDb {
            latest_block_height: 0,
            block_height_to_header_hash: HashMap::new(),
            block_header_hash_to_header: HashMap::new(),
            add_remove_feeds: HashMap::new(),
        }
    }

    pub fn node_to_hash(node: Node) -> Result<HashType> {
        let hex = node.to_string();
        let result = <HashType>::from_hex(hex.strip_prefix("0x").unwrap_or(&hex))?;
        Ok(result)
    }

    pub fn calc_merkle_root(obj: &mut impl SimpleSerialize) -> Result<Node> {
        let result = obj.hash_tree_root()?;
        Ok(result)
    }

    pub fn get_latest_block_height(&self) -> u64 {
        self.latest_block_height
    }

    pub fn get_block_header_by_height(&self, block_height: u64) -> &BlockHeader {
        let header_hash = self.block_height_to_header_hash[&block_height];
        self.get_block_header_by_hash(header_hash)
    }

    pub fn get_block_header_by_hash(&self, header_hash: HashType) -> &BlockHeader {
        &self.block_header_hash_to_header[&header_hash]
    }

    pub fn create_new_block(
        &self,
        sequencer_id: u64,
        new_block_height: u64,
        new_feeds_in_block: Vec<BlockFeedConfig>,
        feed_ids_to_delete_in_block: Vec<u32>,
    ) -> Result<(BlockHeader, FeedActions)> {
        // Populate new and to be removed feeds in block:
        let mut add_remove_feeds = FeedActions::default();

        if new_feeds_in_block.len() > MAX_NEW_FEEDS_IN_BLOCK {
            error!("Trying to insert in block more newly registered feeds {} than supported {}. All above supported limit will be dropped!", new_feeds_in_block.len(), MAX_NEW_FEEDS_IN_BLOCK)
        }

        let mut iter = new_feeds_in_block.into_iter();
        for i in 0..add_remove_feeds.new_feeds.len() {
            if let Some(feed) = iter.next() {
                add_remove_feeds.new_feeds[i] = Some(feed);
            } else {
                add_remove_feeds.new_feeds[i] = None;
            }
        }

        if feed_ids_to_delete_in_block.len() > MAX_FEED_ID_TO_DELETE_IN_BLOCK {
            error!("Trying to insert in block more to be deleted feeds {} than supported {}. All above supported limit will be dropped!", feed_ids_to_delete_in_block.len(), MAX_FEED_ID_TO_DELETE_IN_BLOCK)
        }

        let mut iter = feed_ids_to_delete_in_block.into_iter();
        for i in 0..add_remove_feeds.feed_ids_to_rm.len() {
            if let Some(feed_id) = iter.next() {
                add_remove_feeds.feed_ids_to_rm[i] = Some(feed_id);
            } else {
                add_remove_feeds.feed_ids_to_rm[i] = None;
            }
        }

        let mut block_header = BlockHeader::default();
        let latest_height = self.get_latest_block_height();
        block_header.timestamp = current_unix_time() as u64;
        block_header.block_height = new_block_height;
        block_header.issuer_id = sequencer_id;
        add_remove_feeds.block_height = new_block_height;
        if latest_height == 0 {
            block_header.prev_block_hash = GENESIS_HASH;
        } else {
            let mut latest_header = self.get_block_header_by_height(latest_height).clone();
            let latest_hash = Self::calc_merkle_root(&mut latest_header)?;
            block_header.prev_block_hash = Self::node_to_hash(latest_hash)?;
        }

        let add_remove_feeds_merkle_root = Self::calc_merkle_root(&mut add_remove_feeds)?;
        block_header.add_remove_feeds_merkle_root =
            Self::node_to_hash(add_remove_feeds_merkle_root)?;

        Ok((block_header, add_remove_feeds))
    }

    pub fn add_block(
        &mut self,
        mut header: BlockHeader,
        mut add_remove_feeds: FeedActions,
    ) -> Result<()> {
        let block_height = header.block_height;

        let new_header_hash = Self::node_to_hash(Self::calc_merkle_root(&mut header)?)?;

        self.block_height_to_header_hash
            .insert(block_height, new_header_hash);

        self.block_header_hash_to_header
            .insert(new_header_hash, header);

        self.add_remove_feeds.insert(
            Self::node_to_hash(Self::calc_merkle_root(&mut add_remove_feeds)?)?,
            add_remove_feeds,
        );

        Ok(())
    }

    pub fn add_next_block(
        &mut self,
        header: BlockHeader,
        add_remove_feeds: FeedActions,
    ) -> Result<()> {
        // Check if block can be added as next in blockchain:
        let latest_block_height = self.get_latest_block_height();
        let block_height = header.block_height;
        if block_height <= latest_block_height {
            anyhow::bail!(
                "Block height not as expected, got {}, expected higher than {}!",
                block_height,
                latest_block_height
            );
        }

        if self.get_latest_block_height() == 0 && header.prev_block_hash != GENESIS_HASH {
            anyhow::bail!("First block does not refer genesis in blockchain!");
        }

        if self.get_latest_block_height() != 0 {
            let mut latest_block_header = self
                .get_block_header_by_height(self.get_latest_block_height())
                .clone();
            let latest_block_header_hash =
                Self::node_to_hash(Self::calc_merkle_root(&mut latest_block_header)?)?;
            if header.prev_block_hash != latest_block_header_hash {
                anyhow::bail!("New block does not refer latest in blockchain!");
            }
        }

        self.add_block(header, add_remove_feeds)?;

        self.latest_block_height = block_height;
        Ok(())
    }
}

impl Default for InMemDb {
    fn default() -> Self {
        Self::new()
    }
}
