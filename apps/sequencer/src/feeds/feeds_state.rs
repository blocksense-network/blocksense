use crate::feeds::feed_allocator::ConcurrentAllocator;
use crate::providers::provider::SharedRpcProviders;
use crate::reporters::reporter::SharedReporters;
use feed_registry::registry::AllFeedsReports;
use feed_registry::registry::FeedMetaDataRegistry;
use prometheus::metrics::FeedsMetrics;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use utils::logging::SharedLoggingHandle;

pub struct FeedsState {
    pub registry: Arc<RwLock<FeedMetaDataRegistry>>,
    pub reports: Arc<RwLock<AllFeedsReports>>,
    pub providers: SharedRpcProviders,
    pub log_handle: SharedLoggingHandle,
    pub reporters: SharedReporters,
    pub feed_id_allocator: Arc<RwLock<Option<ConcurrentAllocator>>>,
    pub voting_send_channel: mpsc::UnboundedSender<(String, String)>,
    pub feeds_metrics: Arc<RwLock<FeedsMetrics>>,
    // pub voting_recv_channel: Arc<RwLock<mpsc::UnboundedReceiver<(String, String)>>>,
}
