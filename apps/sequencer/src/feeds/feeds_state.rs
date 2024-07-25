use crate::providers::provider::SharedRpcProviders;
use super::super::utils::logging::SharedLoggingHandle;
use crate::feeds::feed_allocator::ConcurrentAllocator;
use crate::reporters::reporter::SharedReporters;
use feed_registry::registry::AllFeedsReports;
use feed_registry::registry::FeedMetaDataRegistry;
use std::sync::{Arc, RwLock};
use utils::logging::SharedLoggingHandle;
use tokio::sync::mpsc;

pub struct FeedsState {
    pub registry: Arc<RwLock<FeedMetaDataRegistry>>,
    pub reports: Arc<RwLock<AllFeedsReports>>,
    pub providers: SharedRpcProviders,
    pub log_handle: SharedLoggingHandle,
    pub reporters: SharedReporters,
    pub feed_id_allocator: Arc<RwLock<Option<ConcurrentAllocator>>>,
    pub voting_send_channel: mpsc::UnboundedSender<(String, String)>,
    // pub voting_recv_channel: Arc<RwLock<mpsc::UnboundedReceiver<(String, String)>>>,
}
