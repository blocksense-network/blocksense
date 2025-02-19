use data_feeds::feeds_processing::VotedFeedUpdate;
use feed_registry::types::DataFeedPayload;
use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct ConsensusSecondRoundBatch {
    pub sequencer_id: u64,
    pub block_height: u64,
    pub network: String,
    pub contract_address: String,
    pub safe_address: String,
    pub nonce: String,
    pub chain_id: String,
    pub tx_hash: String,
    pub calldata: String, // TODO: send all data needed to validate and recreate calldata.
    pub updates: Vec<VotedFeedUpdate>,
    pub proofs: HashMap<u32, Vec<DataFeedPayload>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ReporterResponse {
    pub block_height: u64,
    pub reporter_id: u64,
    pub network: String,
    pub signature: String,
}
