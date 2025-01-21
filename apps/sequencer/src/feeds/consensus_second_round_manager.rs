use std::collections::{HashMap, VecDeque};
use tracing::{debug, warn};

use crate::ConsensusSecondRoundBatch;

#[derive(Clone, Debug, Hash, Eq, PartialEq)]
struct InProcessBatchKey {
    block_height: u64,
    network: String,
}

#[derive(Clone, Debug)]
struct CallDataWithSignatures {
    calldata: String,
    signatures: HashMap<u64, String>,
}

pub struct AggregationBatchConsensus {
    in_progress_batches: HashMap<InProcessBatchKey, CallDataWithSignatures>,
    backlog_batches: VecDeque<InProcessBatchKey>,
}

impl AggregationBatchConsensus {
    pub fn new() -> AggregationBatchConsensus {
        AggregationBatchConsensus {
            in_progress_batches: HashMap::new(),
            backlog_batches: VecDeque::new(),
        }
    }

    pub fn insert_new_in_process_batch(&mut self, batch: &ConsensusSecondRoundBatch) {
        let key = InProcessBatchKey {
            block_height: batch.block_height,
            network: batch.network.clone(),
        };

        self.backlog_batches.push_back(key.clone());
        self.in_progress_batches.insert(
            key,
            CallDataWithSignatures {
                calldata: batch.calldata.clone(),
                signatures: HashMap::new(),
            },
        );
    }

    pub fn clear_batches_older_than(
        &mut self,
        current_block_height: u64,
        retention_time_blocks: u64,
    ) {
        // Pop elements older than time_point and check if they also need to be removed from in_progress_batches
        while let Some(key) = self.backlog_batches.front() {
            debug!("Cleanup call for: {key:?}");
            if key.block_height + retention_time_blocks >= current_block_height {
                if let Some(calldata_with_signatures) = self.in_progress_batches.remove(&key) {
                    warn!("Removing timed out (did not collect quorum of signatures) entry for network: {}, block_height: {} with calldata: {:?}", key.network, key.block_height, calldata_with_signatures);
                }
                self.backlog_batches.pop_front();
            } else {
                break;
            }
        }
    }
}
