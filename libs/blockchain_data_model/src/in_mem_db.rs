use crate::{AssetFeedUpdate, BlockHeader, DataChunk, FeedIdChunk, FeedUpdates, HashType};
use anyhow::Result;
use hex::FromHex;
use hex_literal::hex;
use ssz_rs::{Node, SimpleSerialize};
use std::collections::HashMap;
use std::fmt::Debug;
use utils::time::current_unix_time;

const GENESIS_HASH: HashType =
    hex!("ec59d3d7860eadc9207b6ccf7c897b23b6b8e82d3d4b80212dfebc15a6b16b17");

pub struct InMemDb {
    latest_block_height: u64,
    block_height_to_header_hash: HashMap<u64, HashType>,
    block_header_hash_to_header: HashMap<HashType, BlockHeader>,
    asset_feed_updates: HashMap<HashType, FeedUpdates>, // The key is the feed_updates_merkle_root from the block header.
}

impl InMemDb {
    pub fn new() -> InMemDb {
        InMemDb {
            latest_block_height: 0,
            block_height_to_header_hash: HashMap::new(),
            block_header_hash_to_header: HashMap::new(),
            asset_feed_updates: HashMap::new(),
        }
    }

    pub fn node_to_hash(node: Node) -> HashType {
        let hex = node.to_string();
        <HashType>::from_hex(hex.strip_prefix("0x").unwrap_or(&hex))
            .expect("Failed to convert node to HashType")
    }

    pub fn calc_merkle_root(obj: &mut impl SimpleSerialize) -> Node {
        obj.hash_tree_root()
            .expect("Failed to calculate Merkle root")
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

    pub fn create_new_block<
        K: Debug + Clone + std::string::ToString + 'static,
        V: Debug + Clone + std::string::ToString + 'static,
    >(
        &self,
        updates: &HashMap<K, V>,
    ) -> (BlockHeader, FeedUpdates) {
        let mut iter = updates.into_iter();

        let mut feed_updates = FeedUpdates::default();

        for i in 0..feed_updates.asset_feed_updates.len() {
            for j in 0..feed_updates.asset_feed_updates[i].len() {
                if let Some((key, val)) = iter.next() {
                    feed_updates.asset_feed_updates[i][j] = Some(AssetFeedUpdate {
                        id: <FeedIdChunk>::from_hex(key.to_string()).expect(
                            format!(
                                "Feed ID must be exactly 4 bytes. Found {}",
                                key.to_string().len()
                            )
                            .as_str(),
                        ),
                        feed_data: <DataChunk>::from_hex(val.to_string()).expect(
                            format!(
                                "Feed Value must be exactly 32 bytes. Found {}",
                                key.to_string().len()
                            )
                            .as_str(),
                        ),
                    });
                } else {
                    feed_updates.asset_feed_updates[i][j] = None;
                }
            }
        }

        let mut block_header = BlockHeader::default();
        let latest_height = self.get_latest_block_height();
        block_header.timestamp = current_unix_time() as u64;
        block_header.block_height = latest_height + 1;
        feed_updates.block_height = latest_height + 1;
        if latest_height == 0 {
            block_header.prev_block_hash = GENESIS_HASH;
        } else {
            let mut latest_header = self.get_block_header_by_height(latest_height).clone();
            let latest_hash = Self::calc_merkle_root(&mut latest_header);
            block_header.prev_block_hash = Self::node_to_hash(latest_hash);
        }
        let feed_updates_merkle_root = Self::calc_merkle_root(&mut feed_updates);
        block_header.feed_updates_merkle_root = Self::node_to_hash(feed_updates_merkle_root);

        (block_header, feed_updates)
    }

    pub fn add_block_at_height(
        &mut self,
        mut header: BlockHeader,
        mut updates: FeedUpdates,
        block_height: u64,
    ) -> Result<()> {
        let feed_updates_merkle_root = Self::node_to_hash(Self::calc_merkle_root(&mut updates));
        if feed_updates_merkle_root != header.feed_updates_merkle_root {
            anyhow::bail!("New block header does not refer the associated updates!");
        }

        let new_header_hash = Self::node_to_hash(Self::calc_merkle_root(&mut header));

        self.block_height_to_header_hash
            .insert(block_height, new_header_hash);

        self.block_header_hash_to_header
            .insert(new_header_hash, header);

        self.asset_feed_updates
            .insert(feed_updates_merkle_root, updates);

        Ok(())
    }

    pub fn add_next_block(&mut self, header: BlockHeader, updates: FeedUpdates) -> Result<()> {
        // Check if block can be added as next in blockchain:
        let next_block_height = self.get_latest_block_height() + 1;
        if header.block_height != next_block_height {
            anyhow::bail!(
                "Block height not as expected, got {}, expected {}!",
                header.block_height,
                next_block_height
            );
        }
        if self.get_latest_block_height() == 0 {
            if header.prev_block_hash != GENESIS_HASH {
                anyhow::bail!("First block does not refer genesis in blockchain!");
            }
        } else {
            let latest_block_header =
                self.get_block_header_by_height(self.get_latest_block_height());
            if header.prev_block_hash
                != Self::node_to_hash(Self::calc_merkle_root(&mut latest_block_header.clone()))
            {
                anyhow::bail!("New block does not refer latest in blockchain!");
            }
        }

        self.add_block_at_height(header, updates, next_block_height)?;

        self.latest_block_height = next_block_height;
        Ok(())
    }
}
