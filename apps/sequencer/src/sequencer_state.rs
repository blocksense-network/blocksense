use crate::feeds::feed_allocator::ConcurrentAllocator;
use crate::feeds::feeds_slots_manager::FeedsSlotsManagerCmds;
use crate::providers::provider::SharedRpcProviders;
use crate::reporters::reporter::SharedReporters;
use config::AllFeedsConfig;
use config::SequencerConfig;
use feed_registry::registry::{AllFeedsReports, FeedAggregateHistory, FeedMetaDataRegistry};
use prometheus::metrics::FeedsMetrics;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use utils::logging::SharedLoggingHandle;

pub struct SequencerState {
    pub registry: Arc<RwLock<FeedMetaDataRegistry>>,
    pub reports: Arc<RwLock<AllFeedsReports>>,
    pub providers: SharedRpcProviders,
    pub log_handle: SharedLoggingHandle,
    pub reporters: SharedReporters,
    pub feed_id_allocator: Arc<RwLock<Option<ConcurrentAllocator>>>,
    pub voting_send_channel: mpsc::UnboundedSender<(String, String)>,
    pub feeds_metrics: Arc<RwLock<FeedsMetrics>>,
    pub feeds_config: Arc<RwLock<AllFeedsConfig>>,
    pub sequencer_config: Arc<RwLock<SequencerConfig>>,
    pub feed_aggregate_history: Arc<RwLock<FeedAggregateHistory>>,
    pub feeds_slots_manager_cmd_send: mpsc::UnboundedSender<FeedsSlotsManagerCmds>,
    // pub voting_recv_channel: Arc<RwLock<mpsc::UnboundedReceiver<(String, String)>>>,
}
