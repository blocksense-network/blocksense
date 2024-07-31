use crate::providers::provider::SharedRpcProviders;
use crate::reporters::reporter::SharedReporters;
use feed_registry::registry::AllFeedsReports;
use feed_registry::registry::FeedMetaDataRegistry;
use std::sync::{Arc, RwLock};
use utils::logging::SharedLoggingHandle;

pub struct FeedsState {
    pub registry: Arc<RwLock<FeedMetaDataRegistry>>,
    pub reports: Arc<RwLock<AllFeedsReports>>,
    pub providers: SharedRpcProviders,
    pub log_handle: SharedLoggingHandle,
    pub reporters: SharedReporters,
}
