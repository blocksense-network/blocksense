use std::{
    env,
    path::{Path, PathBuf},
};

use actix_web::web;
use config::{
    get_sequencer_and_feed_configs, get_test_config_with_single_provider, init_config,
    SequencerConfig,
};
use tokio::sync::mpsc;
use utils::logging::init_shared_logging_handle;

use crate::{providers::provider::init_shared_rpc_providers, sequencer_state::SequencerState};

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

    web::Data::new(SequencerState::new(
        feeds_config,
        providers,
        log_handle,
        &sequencer_config,
        Some(metrics_prefix.as_str()),
        None,
        vote_send,
        feeds_management_cmd_to_block_creator_send,
        feeds_slots_manager_cmd_send,
    ))
}
