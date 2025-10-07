use alloy_primitives::B256;
use std::collections::HashMap;

use crate::providers::eth_send_utils::BatchOfUpdatesToProcess;

/// Holds information tied to blocks that may be reorged (non-finalized)
#[derive(Default)]
pub struct InflightObservations {
    pub non_finalized_updates: HashMap<u64, BatchOfUpdatesToProcess>,
    pub observed_block_hashes: HashMap<u64, B256>,
}

impl InflightObservations {
    pub fn new() -> Self {
        Self {
            non_finalized_updates: HashMap::new(),
            observed_block_hashes: HashMap::new(),
        }
    }

    pub fn insert_non_finalized_update(&mut self, block_height: u64, cmd: BatchOfUpdatesToProcess) {
        self.non_finalized_updates.insert(block_height, cmd);
    }

    pub fn prune_observed_up_to(&mut self, finalized_block: u64) -> usize {
        let keys_to_remove: Vec<u64> = self
            .non_finalized_updates
            .keys()
            .copied()
            .filter(|height| *height <= finalized_block)
            .collect();
        let removed = keys_to_remove.len();
        for height in keys_to_remove {
            tracing::info!("Pruning observed non_finalized_updates for block_height = {height}; finalized_block = {finalized_block}");
            self.non_finalized_updates.remove(&height);
        }

        let hash_keys_to_remove: Vec<u64> = self
            .observed_block_hashes
            .keys()
            .copied()
            .filter(|height| *height <= finalized_block)
            .collect();
        for height in hash_keys_to_remove {
            tracing::info!("Pruning observed block hash for block_height = {height}; finalized_block = {finalized_block}");
            self.observed_block_hashes.remove(&height);
        }

        removed
    }

    pub fn insert_observed_block_hash(&mut self, block_height: u64, hash: B256) {
        self.observed_block_hashes.insert(block_height, hash);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy::signers::local::PrivateKeySigner;
    use alloy_primitives::B256;
    use blocksense_config::{AllFeedsConfig, Provider as ProviderConfig};
    use blocksense_data_feeds::feeds_processing::BatchedAggregatesToSend;
    use blocksense_metrics::metrics::ProviderMetrics;
    use blocksense_registry::config::FeedConfig;
    use blocksense_utils::EncodedFeedId;
    use reqwest::Url;
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use tokio::sync::{Mutex, RwLock};

    use crate::providers::provider::RpcProvider;

    static METRICS_COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn next_metrics_prefix() -> String {
        let suffix = METRICS_COUNTER.fetch_add(1, Ordering::SeqCst);
        format!("test_inflight_{}__", suffix)
    }

    async fn dummy_batch() -> BatchOfUpdatesToProcess {
        let provider_config = ProviderConfig {
            private_key_path: "dummy".to_string(),
            url: "http://localhost:8545".to_string(),
            websocket_url: None,
            transaction_retries_count_limit: 3,
            transaction_retry_timeout_secs: 10,
            retry_fee_increment_fraction: 0.1,
            transaction_gas_limit: 1_000_000,
            impersonated_anvil_account: None,
            is_enabled: true,
            should_load_rb_indices: true,
            allow_feeds: None,
            publishing_criteria: Vec::new(),
            contracts: Vec::new(),
            reorg: blocksense_config::ReorgConfig::default(),
        };
        let provider_config_clone = provider_config.clone();

        let signer = PrivateKeySigner::from_bytes(&B256::from_slice(&[1u8; 32])).unwrap();
        let metrics_prefix = next_metrics_prefix();
        let provider_metrics =
            Arc::new(RwLock::new(ProviderMetrics::new(&metrics_prefix).unwrap()));
        let feeds_config = AllFeedsConfig { feeds: vec![] };

        let rpc_provider = RpcProvider::new(
            "test-network",
            Url::parse("http://localhost:8545").unwrap(),
            &signer,
            &provider_config,
            &provider_metrics,
            &feeds_config,
        )
        .await;

        BatchOfUpdatesToProcess {
            net: "test-network".to_string(),
            provider: Arc::new(Mutex::new(rpc_provider)),
            provider_settings: provider_config_clone,
            updates: BatchedAggregatesToSend {
                block_height: 0,
                updates: vec![],
            },
            feeds_config: Arc::new(RwLock::new(HashMap::<EncodedFeedId, FeedConfig>::new())),
            transaction_retry_timeout_secs: 10,
            transaction_retries_count_limit: 3,
            retry_fee_increment_fraction: 0.1,
        }
    }

    #[tokio::test]
    async fn insert_non_finalized_update_stores_entry() {
        let mut inflight = InflightObservations::new();
        let batch = dummy_batch().await;

        inflight.insert_non_finalized_update(42, batch);

        assert_eq!(inflight.non_finalized_updates.len(), 1);
        assert!(inflight.non_finalized_updates.contains_key(&42));
    }

    #[tokio::test]
    async fn prune_observed_up_to_removes_data_and_returns_removed_count() {
        let mut inflight = InflightObservations::new();
        inflight.insert_observed_block_hash(1, B256::from_slice(&[0x11; 32]));
        inflight.insert_observed_block_hash(2, B256::from_slice(&[0x22; 32]));
        inflight.insert_observed_block_hash(3, B256::from_slice(&[0x33; 32]));
        let batch_one = dummy_batch().await;
        let batch_two = dummy_batch().await;
        inflight.insert_non_finalized_update(1, batch_one);
        inflight.insert_non_finalized_update(3, batch_two);

        let removed = inflight.prune_observed_up_to(2);

        assert_eq!(removed, 1);
        assert!(!inflight.non_finalized_updates.contains_key(&1));
        assert!(inflight.non_finalized_updates.contains_key(&3));
        assert!(!inflight.observed_block_hashes.contains_key(&1));
        assert!(!inflight.observed_block_hashes.contains_key(&2));
        assert!(inflight.observed_block_hashes.contains_key(&3));
    }

    #[tokio::test]
    async fn insert_observed_block_hash_overwrites_previous_value() {
        let mut inflight = InflightObservations::new();
        inflight.insert_observed_block_hash(7, B256::from_slice(&[0x44; 32]));
        inflight.insert_observed_block_hash(7, B256::from_slice(&[0x55; 32]));

        let stored = inflight.observed_block_hashes.get(&7).unwrap();
        assert_eq!(stored, &B256::from_slice(&[0x55; 32]));
    }
}
