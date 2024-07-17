use std::sync::{Arc, RwLock};

use actix_web::{web, App, HttpServer};
use sequencer::feeds::feeds_registry::{new_feeds_meta_data_reg_from_config, AllFeedsReports};
use sequencer::feeds::feeds_slots_manager;
use sequencer::feeds::feeds_state::FeedsState;
use sequencer::feeds::{
    votes_result_batcher::votes_result_batcher_loop, votes_result_sender::votes_result_sender_loop,
};
use sequencer::plugin_registry;
use sequencer::providers::provider::init_shared_rpc_providers;
use tokio::sync::mpsc;

use crate::feeds_slots_manager::feeds_slots_manager_loop;
use sequencer::reporters::reporter::init_shared_reporters;

use sequencer::http_handlers::admin::{deploy, get_feed_report_interval, get_key, set_log_level};
use sequencer::http_handlers::data_feeds::post_report;
use sequencer::http_handlers::registry::{
    registry_plugin_get, registry_plugin_size, registry_plugin_upload,
};
use sequencer::metrics_collector::metrics_collector::metrics_collector_loop;
use sequencer::utils::logging::init_shared_logging_handle;

use actix_web::rt::spawn;
use futures::stream::FuturesUnordered;
use sequencer::config::config::init_sequencer_config;
use sequencer::http_handlers::admin::metrics;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let sequencer_config = init_sequencer_config();
    let log_handle = init_shared_logging_handle();

    // This trigger spawns threads, which Ctrl+C does not kill.  So
    // for this case we need to detect Ctrl+C and shut those threads
    // down.  For simplicity, we do this by terminating the process.
    tokio::spawn(async move {
        tokio::signal::ctrl_c().await.unwrap();
        std::process::exit(0);
    });

    let providers = init_shared_rpc_providers(&sequencer_config).await;

    let app_state = web::Data::new(FeedsState {
        registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_from_config(
            &sequencer_config,
        ))),
        reports: Arc::new(RwLock::new(AllFeedsReports::new())),
        plugin_registry: Arc::new(RwLock::new(plugin_registry::CappedHashMap::new())),
        providers: providers.clone(),
        log_handle,
        reporters: init_shared_reporters(&sequencer_config),
    });

    let (vote_send, vote_recv) = mpsc::unbounded_channel();

    let send_channel: mpsc::UnboundedSender<(String, String)> = vote_send.clone();
    let feeds_slots_manager_loop_fut =
        feeds_slots_manager_loop(app_state.clone(), send_channel).await;

    let (batched_votes_send, batched_votes_recv) = mpsc::unbounded_channel();

    let votes_batcher = votes_result_batcher_loop(
        vote_recv,
        batched_votes_send,
        sequencer_config.max_keys_to_batch,
        sequencer_config.keys_batch_duration,
    )
    .await;

    let votes_sender = votes_result_sender_loop(batched_votes_recv, providers).await;

    let metrics_collector = metrics_collector_loop().await;

    let main_http_server_fut = spawn(async move {
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
                .service(get_feed_report_interval)
        })
        .bind(("0.0.0.0", sequencer_config.main_port))
        .expect("Main HTTP server could not bind to port.")
        .run()
        .await
    });

    let collected_futures = FuturesUnordered::new();
    collected_futures.push(feeds_slots_manager_loop_fut);
    collected_futures.push(main_http_server_fut);
    collected_futures.push(votes_batcher);
    collected_futures.push(votes_sender);
    collected_futures.push(metrics_collector);

    let prometheus_http_server_fut = spawn(async move {
        HttpServer::new(move || App::new().service(metrics))
            .bind(("0.0.0.0", sequencer_config.prometheus_port))
            .expect("Prometheus HTTP server could not bind to port.")
            .run()
            .await
    });
    collected_futures.push(prometheus_http_server_fut);

    let result = futures::future::join_all(collected_futures).await;
    for v in result {
        match v {
            Ok(res) => match res {
                Ok(x) => x,
                Err(e) => {
                    panic!("TaskError: {}", e.to_string());
                }
            },
            Err(e) => {
                panic!("JoinError: {} ", e.to_string());
            }
        }
    }
    Ok({})
}
