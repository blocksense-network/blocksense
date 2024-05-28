use std::sync::{Arc, RwLock};

use actix_web::{web, App, HttpServer};
use sequencer::feeds::feed_slots_manager::FeedSlotsManager;
use sequencer::feeds::feeds_registry::{new_feeds_meta_data_reg_with_test_data, AllFeedsReports};
use sequencer::feeds::feeds_state::FeedsState;
use sequencer::feeds::{
    votes_result_batcher::VotesResultBatcher, votes_result_sender::VotesResultSender,
};
use sequencer::plugin_registry;
use sequencer::providers::provider::{init_shared_rpc_providers, SharedRpcProviders};
use tokio::sync::mpsc;

use tracing::debug;

use sequencer::http_handlers::http_handlers::{
    deploy, get_key, index_post, registry_plugin_get, registry_plugin_size, registry_plugin_upload,
    set_log_level,
};
use sequencer::metrics_collector::metrics_collector::MetricsCollector;
use sequencer::utils::logging::{init_shared_logging_handle, SharedLoggingHandle};

use once_cell::sync::Lazy;
static PROVIDERS: Lazy<SharedRpcProviders> = Lazy::new(|| init_shared_rpc_providers());
static GLOBAL_LOG_HANDLE: Lazy<SharedLoggingHandle> = Lazy::new(|| init_shared_logging_handle());

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // init global logger.
    drop(
        GLOBAL_LOG_HANDLE
            .lock()
            .expect("Could not acquire GLOBAL_LOG_HANDLE's mutex"),
    );

    let app_state = web::Data::new(FeedsState {
        registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_with_test_data())),
        reports: Arc::new(RwLock::new(AllFeedsReports::new())),
        plugin_registry: Arc::new(RwLock::new(plugin_registry::CappedHashMap::new())),
        providers: PROVIDERS.clone(),
        log_handle: GLOBAL_LOG_HANDLE.clone(),
    });

    let mut feed_managers = Vec::new();

    let (vote_send, vote_recv) = mpsc::unbounded_channel();

    {
        let reg = app_state
            .registry
            .write()
            .expect("Could not lock all feeds meta data registry.");
        let keys = reg.get_keys();
        for key in keys {
            let send_channel: mpsc::UnboundedSender<(String, String)> = vote_send.clone();

            debug!("key = {} : value = {:?}", key, reg.get(key));

            let feed = match reg.get(key) {
                Some(x) => x,
                None => panic!("Error timer for feed that was not registered."),
            };

            let lock_err_msg = "Could not lock feed meta data registry for read";
            let name = feed.read().expect(lock_err_msg).get_name().clone();
            let report_interval_ms = feed.read().expect(lock_err_msg).get_report_interval_ms();
            let first_report_start_time = feed
                .read()
                .expect(lock_err_msg)
                .get_first_report_start_time_ms();

            feed_managers.push(FeedSlotsManager::new(
                send_channel,
                feed,
                name,
                report_interval_ms,
                first_report_start_time,
                app_state.clone(),
                key,
            ));
        }
    }

    let (batched_votes_send, batched_votes_recv) = mpsc::unbounded_channel();

    let _votes_batcher = VotesResultBatcher::new(vote_recv, batched_votes_send);

    let _votes_sender = VotesResultSender::new(batched_votes_recv, PROVIDERS.clone());

    let _metrics_collector = MetricsCollector::new();

    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .service(get_key)
            .service(deploy)
            .service(index_post)
            .service(set_log_level)
            .service(registry_plugin_upload)
            .service(registry_plugin_get)
            .service(registry_plugin_size)
    })
    .bind(("0.0.0.0", 8877))?
    .run()
    .await
}
