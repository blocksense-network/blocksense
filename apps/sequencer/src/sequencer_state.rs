use crate::feeds::consensus_second_round_manager::AggregationBatchConsensus;
use crate::feeds::feed_allocator::{init_concurrent_allocator, ConcurrentAllocator};
use crate::providers::eth_send_utils::BatchOfUpdatesToProcess;
use crate::providers::provider::ProviderStatus;
use crate::providers::provider::SharedRpcProviders;
use crate::providers::provider::{init_shared_rpc_providers, RpcProvider};
use crate::reporters::reporter::init_shared_reporters;
use crate::reporters::reporter::SharedReporters;
use blocksense_blockchain_data_model::in_mem_db::InMemDb;
use blocksense_config::{AllFeedsConfig, SequencerConfig};
use blocksense_data_feeds::feeds_processing::VotedFeedUpdateWithProof;
use blocksense_feed_registry::feed_registration_cmds::FeedsManagementCmds;
use blocksense_feed_registry::registry::new_feeds_meta_data_reg_from_config;
use blocksense_feed_registry::registry::{
    AllFeedsReports, FeedAggregateHistory, FeedMetaDataRegistry,
};
use blocksense_gnosis_safe::data_types::ReporterResponse;
use blocksense_gnosis_safe::utils::SignatureWithAddress;
use blocksense_metrics::metrics::FeedsMetrics;
use blocksense_registry::config::FeedConfig;
use blocksense_utils::counter_unbounded_channel::{
    counted_unbounded_channel, CountedReceiver, CountedSender,
};
use blocksense_utils::logging::{init_shared_logging_handle, SharedLoggingHandle};
use blocksense_utils::FeedId;
use eyre::eyre;
use rdkafka::producer::FutureProducer;
use rdkafka::ClientConfig;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio::sync::Mutex;
use tokio::sync::RwLock;

pub struct SequencerState {
    pub registry: Arc<RwLock<FeedMetaDataRegistry>>,
    pub reports: Arc<RwLock<AllFeedsReports>>,
    pub providers: SharedRpcProviders,
    pub log_handle: SharedLoggingHandle,
    pub reporters: SharedReporters,
    pub feed_id_allocator: Arc<RwLock<Option<ConcurrentAllocator>>>,
    pub aggregated_votes_to_block_creator_send: UnboundedSender<VotedFeedUpdateWithProof>,
    pub feeds_metrics: Arc<RwLock<FeedsMetrics>>,
    pub active_feeds: Arc<RwLock<HashMap<FeedId, FeedConfig>>>,
    pub sequencer_config: Arc<RwLock<SequencerConfig>>,
    pub feed_aggregate_history: Arc<RwLock<FeedAggregateHistory>>,
    pub feeds_management_cmd_to_block_creator_send: UnboundedSender<FeedsManagementCmds>,
    pub feeds_slots_manager_cmd_send: UnboundedSender<FeedsManagementCmds>,
    pub blockchain_db: Arc<RwLock<InMemDb>>,
    pub kafka_endpoint: Option<FutureProducer>,
    pub provider_status: Arc<RwLock<HashMap<String, ProviderStatus>>>,
    pub batches_awaiting_consensus: Arc<RwLock<AggregationBatchConsensus>>,
    pub aggregate_batch_sig_send: UnboundedSender<(ReporterResponse, SignatureWithAddress)>,
    pub relayers_send_channels:
        Arc<RwLock<HashMap<String, CountedSender<BatchOfUpdatesToProcess>>>>,
    // pub voting_recv_channel: Arc<RwLock<mpsc::UnboundedReceiver<(String, String)>>>,
}

impl SequencerState {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        feeds_config: AllFeedsConfig,
        providers: SharedRpcProviders,
        log_handle: SharedLoggingHandle,
        sequencer_config: &SequencerConfig,
        metrics_prefix: Option<&str>,
        feed_id_allocator: Option<ConcurrentAllocator>,
        aggregated_votes_to_block_creator_send: UnboundedSender<VotedFeedUpdateWithProof>,
        feeds_management_cmd_to_block_creator_send: UnboundedSender<FeedsManagementCmds>,
        feeds_slots_manager_cmd_send: UnboundedSender<FeedsManagementCmds>,
        aggregate_batch_sig_send: UnboundedSender<(ReporterResponse, SignatureWithAddress)>,
        relayers_send_channels: Arc<
            RwLock<HashMap<String, CountedSender<BatchOfUpdatesToProcess>>>,
        >,
    ) -> SequencerState {
        let provider_status: HashMap<String, ProviderStatus> = sequencer_config
            .providers
            .iter()
            .map(|(provider_name, provider)| {
                let initial_state = if provider.is_enabled {
                    ProviderStatus::AwaitingFirstUpdate
                } else {
                    ProviderStatus::Disabled
                };
                (provider_name.clone(), initial_state)
            })
            .collect();
        let provider_status = Arc::new(RwLock::new(provider_status));
        let mut history = FeedAggregateHistory::new();
        for feed in &feeds_config.feeds {
            history.register_feed(feed.id, 100);
        }
        SequencerState {
            registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_from_config(
                &feeds_config,
            ))),
            reports: Arc::new(RwLock::new(AllFeedsReports::new())),
            providers,
            log_handle,
            reporters: init_shared_reporters(sequencer_config, metrics_prefix),
            feed_id_allocator: Arc::new(RwLock::new(feed_id_allocator)),
            aggregated_votes_to_block_creator_send,
            feeds_metrics: Arc::new(RwLock::new(
                FeedsMetrics::new(metrics_prefix.unwrap_or(""))
                    .expect("Failed to allocate feed_metrics"),
            )),
            active_feeds: Arc::new(RwLock::new(
                feeds_config
                    .feeds
                    .into_iter()
                    .map(|feed| (feed.id, feed))
                    .collect(),
            )),
            sequencer_config: Arc::new(RwLock::new(sequencer_config.clone())),
            feed_aggregate_history: Arc::new(RwLock::new(history)),
            feeds_management_cmd_to_block_creator_send,
            feeds_slots_manager_cmd_send,
            blockchain_db: Arc::new(RwLock::new(InMemDb::new())),
            kafka_endpoint: sequencer_config
                .kafka_report_endpoint
                .url
                .as_ref()
                .map(|url| {
                    create_kafka_producer(url)
                        .expect("Could not create kafka communication channel.")
                }),
            provider_status,
            batches_awaiting_consensus: Arc::new(RwLock::new(AggregationBatchConsensus::new())),
            aggregate_batch_sig_send,
            relayers_send_channels,
        }
    }

    pub async fn get_provider(&self, network: &str) -> Option<Arc<Mutex<RpcProvider>>> {
        self.providers.read().await.get(network).cloned()
    }

    pub async fn deploy_contract(
        &self,
        network: &str,
        contract_name: &str,
    ) -> Result<String, eyre::Error> {
        let Some(p) = self.get_provider(network).await else {
            return Err(eyre!("No provider for network {}", network));
        };
        let mut p = p.lock().await;
        p.deploy_contract(contract_name).await
    }
}

// Exclusively take config structure to init sequencer_state
pub async fn create_sequencer_state_from_sequencer_config(
    sequencer_config: SequencerConfig,
    metrics_prefix: &str,
    feeds_config: AllFeedsConfig,
) -> (
    actix_web::web::Data<SequencerState>,
    UnboundedReceiver<VotedFeedUpdateWithProof>, // aggregated_votes_to_block_creator_recv
    UnboundedReceiver<FeedsManagementCmds>,      // feeds_management_cmd_to_block_creator_recv
    UnboundedReceiver<FeedsManagementCmds>,      // feeds_slots_manager_cmd_recv
    UnboundedReceiver<(ReporterResponse, SignatureWithAddress)>, // aggregate_batch_sig_recv
    HashMap<String, CountedReceiver<BatchOfUpdatesToProcess>>, // relayers_recv_channels
) {
    let log_handle = init_shared_logging_handle("INFO", false);
    let providers =
        init_shared_rpc_providers(&sequencer_config, Some(metrics_prefix), &feeds_config).await;

    let (relayers_send_channels, relayers_recv_channels) =
        create_relayers_channels(&providers).await;

    let (vote_send, vote_recv) = mpsc::unbounded_channel();
    let (feeds_management_cmd_to_block_creator_send, feeds_management_cmd_to_block_creator_recv) =
        mpsc::unbounded_channel();
    let (feeds_slots_manager_cmd_send, feeds_slots_manager_cmd_recv) = mpsc::unbounded_channel();
    let (aggregate_batch_sig_send, aggregate_batch_sig_recv) = mpsc::unbounded_channel();
    let aggregated_votes_to_block_creator_send = vote_send;
    let feed_id_allocator = Some(init_concurrent_allocator());
    let sequencer_state = SequencerState::new(
        feeds_config.clone(),
        providers,
        log_handle,
        &sequencer_config,
        Some(metrics_prefix),
        feed_id_allocator,
        aggregated_votes_to_block_creator_send,
        feeds_management_cmd_to_block_creator_send,
        feeds_slots_manager_cmd_send,
        aggregate_batch_sig_send,
        Arc::new(RwLock::new(relayers_send_channels)),
    );

    (
        actix_web::web::Data::new(sequencer_state),
        vote_recv,
        feeds_management_cmd_to_block_creator_recv,
        feeds_slots_manager_cmd_recv,
        aggregate_batch_sig_recv,
        relayers_recv_channels,
    )
}

fn create_kafka_producer(
    bootstrap_server: &str,
) -> Result<FutureProducer, Box<dyn std::error::Error>> {
    Ok(ClientConfig::new()
        .set("bootstrap.servers", bootstrap_server)
        .set("queue.buffering.max.ms", "0")
        .create()?)
}

pub async fn create_relayers_channels(
    providers: &SharedRpcProviders,
) -> (
    HashMap<String, CountedSender<BatchOfUpdatesToProcess>>,
    HashMap<String, CountedReceiver<BatchOfUpdatesToProcess>>,
) {
    let mut relayers_send_channels = HashMap::new();
    let mut relayers_recv_channels = HashMap::new();
    {
        let providers = providers.read().await;
        for (net_name, _provider) in providers.iter() {
            let (s, r) = counted_unbounded_channel();
            relayers_send_channels.insert(net_name.clone(), s);
            relayers_recv_channels.insert(net_name.clone(), r);
        }
    }
    (relayers_send_channels, relayers_recv_channels)
}
