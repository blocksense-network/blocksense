use crate::feeds::feed_allocator::ConcurrentAllocator;
use crate::providers::provider::SharedRpcProviders;
use crate::reporters::reporter::SharedReporters;
use blockchain_data_model::in_mem_db::InMemDb;
use config::FeedConfig;
use config::SequencerConfig;
use feed_registry::feed_registration_cmds::FeedsManagementCmds;
use feed_registry::registry::{AllFeedsReports, FeedAggregateHistory, FeedMetaDataRegistry};
use prometheus::metrics::FeedsMetrics;
use rdkafka::producer::FutureProducer;
use std::collections::HashMap;
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
    pub active_feeds: Arc<RwLock<HashMap<u32, FeedConfig>>>,
    pub sequencer_config: Arc<RwLock<SequencerConfig>>,
    pub feed_aggregate_history: Arc<RwLock<FeedAggregateHistory>>,
    pub feeds_management_cmd_to_block_creator_send: mpsc::UnboundedSender<FeedsManagementCmds>,
    pub feeds_slots_manager_cmd_send: mpsc::UnboundedSender<FeedsManagementCmds>,
    pub blockchain_db: Arc<RwLock<InMemDb>>,
    pub kafka_endpoint: Option<FutureProducer>,
    // pub voting_recv_channel: Arc<RwLock<mpsc::UnboundedReceiver<(String, String)>>>,
}
