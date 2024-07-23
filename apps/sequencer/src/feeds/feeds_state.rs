use super::super::utils::logging::SharedLoggingHandle;
use crate::feeds::feeds_registry::AllFeedsReports;
use crate::feeds::feeds_registry::FeedMetaDataRegistry;
use crate::providers::provider::SharedRpcProviders;
use crate::reporters::reporter::SharedReporters;
use std::sync::{Arc, RwLock};

pub struct FeedsState {
    pub registry: Arc<RwLock<FeedMetaDataRegistry>>,
    pub reports: Arc<RwLock<AllFeedsReports>>,
    pub providers: SharedRpcProviders,
    pub log_handle: SharedLoggingHandle,
    pub reporters: SharedReporters,
}
