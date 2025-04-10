use blocksense_gnosis_safe::data_types::ConsensusSecondRoundBatch;
use blocksense_gnosis_safe::data_types::ReporterResponse;
use blocksense_gnosis_safe::utils::{SafeTx, SignatureWithAddress};
use std::collections::HashSet;
use std::collections::{HashMap, VecDeque};
use tracing::{debug, error, warn};

#[derive(Clone, Debug, Hash, Eq, PartialEq)]
pub struct InProcessBatchKey {
    block_height: u64,
    network: String,
}

#[derive(Clone, Debug)]
pub struct CallDataWithSignatures {
    pub tx_hash: String,
    pub safe_tx: SafeTx,
    pub signatures: HashMap<u64, SignatureWithAddress>,
    pub updated_feeds_ids: HashSet<u32>,
}

pub struct AggregationBatchConsensus {
    pub in_progress_batches: HashMap<InProcessBatchKey, CallDataWithSignatures>,
    backlog_batches: VecDeque<InProcessBatchKey>,
}

impl AggregationBatchConsensus {
    pub fn new() -> AggregationBatchConsensus {
        AggregationBatchConsensus {
            in_progress_batches: HashMap::new(),
            backlog_batches: VecDeque::new(),
        }
    }

    pub fn get_batch_waiting_signatures(
        &self,
        block_height: u64,
        network: &str,
    ) -> Option<CallDataWithSignatures> {
        self.in_progress_batches
            .get(&InProcessBatchKey {
                block_height,
                network: network.to_string(),
            })
            .cloned()
    }

    pub fn insert_new_in_process_batch(
        &mut self,
        batch: &ConsensusSecondRoundBatch,
        safe_transaction: SafeTx,
    ) {
        let key = InProcessBatchKey {
            block_height: batch.block_height,
            network: batch.network.clone(),
        };

        if self.in_progress_batches.contains_key(&key) {
            error!(
                "Trying to register twice the same batch for block: {}, network: {}",
                batch.block_height, batch.network
            );
            return;
        }

        let feeds_to_update_ids: Vec<u32> =
            batch.updates.iter().map(|update| update.feed_id).collect();

        self.backlog_batches.push_back(key.clone());
        self.in_progress_batches.insert(
            key,
            CallDataWithSignatures {
                tx_hash: batch.tx_hash.clone(),
                safe_tx: safe_transaction,
                signatures: HashMap::new(),
                updated_feeds_ids: feeds_to_update_ids.into_iter().collect(),
            },
        );
    }

    pub fn insert_reporter_signature(
        &mut self,
        response: &ReporterResponse,
        sig: SignatureWithAddress,
    ) -> usize {
        let batch = self.in_progress_batches.get_mut(&InProcessBatchKey {
            block_height: response.block_height,
            network: response.network.clone(),
        });
        if let Some(val) = batch {
            val.signatures.insert(response.reporter_id, sig);
            val.signatures.len()
        } else {
            error!("Aggregated batch associated to key: {response:?} does not exist!");
            0
        }
    }

    pub fn take_reporters_signatures(
        &mut self,
        block_height: u64,
        network: String,
    ) -> Option<CallDataWithSignatures> {
        self.in_progress_batches.remove(&InProcessBatchKey {
            block_height,
            network,
        })
    }

    pub fn clear_batches_older_than(
        &mut self,
        current_block_height: u64,
        retention_time_blocks: u64,
    ) {
        // Pop elements older than time_point and check if they also need to be removed from in_progress_batches
        while let Some(key) = self.backlog_batches.front() {
            if key.block_height + retention_time_blocks >= current_block_height {
                break;
            }
            debug!("Cleanup call for: {key:?}");
            if let Some(calldata_with_signatures) = self.in_progress_batches.remove(key) {
                warn!("Removing timed out (did not collect quorum of signatures as of block {}) entry for network: {}, block_height: {} with calldata: {:?}",
                    current_block_height,
                    key.network,
                    key.block_height,
                    calldata_with_signatures);
            } else {
                debug!("{key:?} has collected quorum of signatures");
            }
            self.backlog_batches.pop_front();
        }
    }
}

impl Default for AggregationBatchConsensus {
    fn default() -> Self {
        Self::new()
    }
}
