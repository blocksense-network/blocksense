use std::sync::{Arc, RwLock};

use actix_web::{web, App, HttpServer};
use sequencer::feeds::feeds_registry::{new_feeds_meta_data_reg_with_test_data, AllFeedsReports};
use sequencer::feeds::feeds_slots_manager;
use sequencer::feeds::feeds_state::FeedsState;
use sequencer::feeds::{
    votes_result_batcher::VotesResultBatcher, votes_result_sender::VotesResultSender,
};
use sequencer::plugin_registry;
use sequencer::providers::provider::init_shared_rpc_providers;
use tokio::sync::mpsc;

use crate::feeds_slots_manager::feeds_slots_manager_loop;
use sequencer::reporters::reporter::init_shared_reporters;

use sequencer::http_handlers::admin::{deploy, get_key, set_log_level};
use sequencer::http_handlers::data_feeds::post_report;
use sequencer::http_handlers::registry::{
    registry_plugin_get, registry_plugin_size, registry_plugin_upload,
};
use sequencer::metrics_collector::metrics_collector::MetricsCollector;
use sequencer::utils::logging::init_shared_logging_handle;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let providers = init_shared_rpc_providers();

    let app_state = web::Data::new(FeedsState {
        registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_with_test_data())),
        reports: Arc::new(RwLock::new(AllFeedsReports::new())),
        plugin_registry: Arc::new(RwLock::new(plugin_registry::CappedHashMap::new())),
        providers: providers.clone(),
        log_handle: init_shared_logging_handle(),
        reporters: init_shared_reporters(),
    });

    let (vote_send, vote_recv) = mpsc::unbounded_channel();

    let send_channel: mpsc::UnboundedSender<(String, String)> = vote_send.clone();
    let _feeds_slots_manager_loop = feeds_slots_manager_loop(app_state.clone(), send_channel);

    let (batched_votes_send, batched_votes_recv) = mpsc::unbounded_channel();

    let _votes_batcher = VotesResultBatcher::new(vote_recv, batched_votes_send);

    let _votes_sender = VotesResultSender::new(batched_votes_recv, providers);

    let _metrics_collector = MetricsCollector::new();

    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .service(get_key)
            .service(deploy)
            .service(post_report)
            .service(set_log_level)
            .service(registry_plugin_upload)
            .service(registry_plugin_get)
            .service(registry_plugin_size)
    })
    .bind(("0.0.0.0", 8877))?
    .run()
    .await
}
