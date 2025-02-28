pub mod aggregate_batch_consensus_processor;
pub mod block_creator;
pub mod blocks_reader;
pub mod feeds;
pub mod http_handlers;
pub mod metrics_collector;
pub mod providers;
pub mod reporters;
pub mod sequencer_state;

use data_feeds::feeds_processing::VotedFeedUpdate;
use feed_registry::types::DataFeedPayload;
use std::collections::HashMap;
use tracing::error;

#[derive(Debug, Clone, Default)]
pub struct BatchedAggegratesToSend {
    pub block_height: u64,
    pub updates: Vec<VotedFeedUpdate>,
    // The key in this map is the feed id for which we provide a proof for the aggregated value.
    pub proofs: HashMap<u32, Vec<DataFeedPayload>>,
}

impl BatchedAggegratesToSend {
    // The updates to be sent to different networks go through multiple filters.
    // Eventually we might need to reduce the proof to only contain records for
    // the relevant updates. The following function does that and returns the
    // count of removed elements.
    pub fn normalize_proof(&mut self) -> usize {
        let removed_elements_count = self.proofs.len() - self.updates.len();

        if removed_elements_count > 0 {
            let mut normalized_proofs = HashMap::new();
            for update in self.updates.iter() {
                let Some(proof) = self.proofs.remove(&update.feed_id) else {
                    error!("Logical ERROR! no proof found for key: {}", update.feed_id);
                    continue;
                };
                normalized_proofs.insert(update.feed_id, proof);
            }
        }
        removed_elements_count
    }
}
