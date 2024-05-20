use crate::feeds::feeds_registry::AllFeedsReports;
use crate::feeds::feeds_registry::FeedMetaDataRegistry;
use std::sync::{Arc, RwLock};

pub struct FeedsState {
    pub registry: Arc<RwLock<FeedMetaDataRegistry>>,
    pub reports: Arc<RwLock<AllFeedsReports>>,
}
