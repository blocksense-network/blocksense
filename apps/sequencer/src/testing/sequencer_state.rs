use std::{
    env,
    path::{Path, PathBuf},
    sync::Arc,
};

use actix_web::web;
use blockchain_data_model::in_mem_db::InMemDb;
use config::{
    get_sequencer_and_feed_configs, get_test_config_with_single_provider, init_config,
    SequencerConfig,
};
use feed_registry::registry::{
    new_feeds_meta_data_reg_from_config, AllFeedsReports, FeedAggregateHistory,
};
use prometheus::metrics::FeedsMetrics;
use tokio::sync::{mpsc, RwLock};
use utils::logging::init_shared_logging_handle;

use crate::{
    providers::provider::init_shared_rpc_providers, reporters::reporter::init_shared_reporters,
    sequencer_state::SequencerState,
};

// Creates sequencer state using the default config file and uses overwrite_config
// or a config with a single provider if no overwrite_config is specified.
pub async fn create_sequencer_state_from_sequencer_config_file(
    network: &str,
    key_path: &Path,
    anvil_endpoint: &str,
    vote_send: Option<mpsc::UnboundedSender<(String, String)>>,
    overwrite_config: Option<SequencerConfig>,
) -> web::Data<SequencerState> {
    let cfg = match &overwrite_config {
        Some(c) => c.clone(),
        None => get_test_config_with_single_provider(network, key_path, anvil_endpoint),
    };
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let sequencer_config_file = PathBuf::new()
        .join(manifest_dir)
        .join("tests")
        .join("sequencer_config.json");
    let mut sequencer_config =
        init_config::<SequencerConfig>(&sequencer_config_file).expect("Failed to load config:");

    let metrics_prefix = format!("create_sequencer_state_from_sequencer_config_{network}");

    let providers = init_shared_rpc_providers(&cfg, Some(metrics_prefix.as_str())).await;

    if overwrite_config.is_some() {
        sequencer_config.providers = cfg.providers.clone();
    }

    let log_handle = init_shared_logging_handle("INFO", false);

    let vote_send = match vote_send {
        Some(vote_send) => vote_send,
        None => {
            let (vote_send, _vote_recv) = mpsc::unbounded_channel();
            vote_send
        }
    };

    let (feeds_management_cmd_to_block_creator_send, _feeds_management_cmd_to_block_creator_recv) =
        mpsc::unbounded_channel();
    let (feeds_slots_manager_cmd_send, _feeds_slots_manager_cmd_recv) = mpsc::unbounded_channel();

    let (_, feeds_config) = get_sequencer_and_feed_configs();

    web::Data::new(SequencerState {
        registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_from_config(
            &feeds_config,
        ))),
        reports: Arc::new(RwLock::new(AllFeedsReports::new())),
        providers,
        log_handle,
        reporters: init_shared_reporters(&cfg, Some(metrics_prefix.as_str())),
        feed_id_allocator: Arc::new(RwLock::new(None)),
        aggregated_votes_to_block_creator_send: vote_send,
        feeds_metrics: Arc::new(RwLock::new(
            FeedsMetrics::new(metrics_prefix.as_str()).expect("Failed to allocate feed_metrics"),
        )),
        active_feeds: Arc::new(RwLock::new(
            feeds_config
                .feeds
                .into_iter()
                .map(|feed| (feed.id, feed))
                .collect(),
        )),
        sequencer_config: Arc::new(RwLock::new(sequencer_config.clone())),
        feed_aggregate_history: Arc::new(RwLock::new(FeedAggregateHistory::new())),
        feeds_management_cmd_to_block_creator_send,
        feeds_slots_manager_cmd_send,
        blockchain_db: Arc::new(RwLock::new(InMemDb::new())),
        kafka_endpoint: None,
    })
}
