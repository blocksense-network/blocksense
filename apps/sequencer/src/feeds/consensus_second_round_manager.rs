use std::{
    collections::{HashMap, VecDeque},
    time::{SystemTime, UNIX_EPOCH},
};
use tracing::{debug, warn};

use crate::ConsensusSecondRoundBatch;

#[derive(Clone, Debug, Hash, Eq, PartialEq)]
struct InProcessBatchKey {
    block_height: u64,
    network: String,
}

#[derive(Clone, Debug)]
struct BacklogEntry {
    timestamp: u64,
    key: InProcessBatchKey,
}

pub struct AggregationBatchConsensus {
    in_progress_batches: HashMap<InProcessBatchKey, String>, // TODO: Add collected signatures
    backlog_batches: VecDeque<BacklogEntry>,
}

impl AggregationBatchConsensus {
    pub fn new() -> AggregationBatchConsensus {
        AggregationBatchConsensus {
            in_progress_batches: HashMap::new(),
            backlog_batches: VecDeque::new(),
        }
    }

    pub fn insert(&mut self, batch: &ConsensusSecondRoundBatch) {
        let now = SystemTime::now();
        // Convert to UNIX time (duration since the epoch)
        let duration_since_epoch = now
            .duration_since(UNIX_EPOCH)
            .expect("SystemTime before UNIX EPOCH!");
        // Extract seconds
        let seconds = duration_since_epoch.as_secs();

        let key = InProcessBatchKey {
            block_height: batch.block_height,
            network: batch.network.clone(),
        };

        self.backlog_batches.push_back(BacklogEntry {
            timestamp: seconds,
            key: key.clone(),
        });
        self.in_progress_batches.insert(key, batch.calldata.clone());
    }

    pub fn clear_batches_older_than(&mut self, current_time_sec: u64, retention_time_sec: u64) {
        // Pop elements older than time_point and check if they also need to be removed from in_progress_batches
        while let Some(value) = self.backlog_batches.front() {
            debug!("Cleanup call for: {value:?}");
            if value.timestamp + retention_time_sec >= current_time_sec {
                if let Some(calldata) = self.in_progress_batches.remove(&value.key) {
                    warn!("Removing timed out (did not collect quorum of signatures) entry for network: {}, block_height: {} with calldata: {}", value.key.network, value.key.block_height, calldata);
                }
                self.backlog_batches.pop_front();
            } else {
                break;
            }
        }
    }
}
