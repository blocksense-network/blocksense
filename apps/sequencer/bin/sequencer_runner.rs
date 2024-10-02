use std::sync::Arc;

use actix_web::{web, App, HttpServer};
use feed_registry::registry::{
    new_feeds_meta_data_reg_from_config, AllFeedsReports, FeedAggregateHistory,
};
use sequencer::feeds::feeds_slots_manager::FeedsSlotsManagerCmds;
use sequencer::providers::provider::init_shared_rpc_providers;
use sequencer::sequencer_state::SequencerState;
use tokio::sync::{mpsc, RwLock};

use sequencer::reporters::reporter::init_shared_reporters;

use sequencer::http_handlers::admin::{
    deploy, get_feed_config, get_feed_report_interval, get_feeds_config, get_key,
    get_sequencer_config, register_asset_feed, set_log_level,
};
use sequencer::http_handlers::data_feeds::{post_report, post_reports_batch, register_feed};
use utils::logging::{
    get_log_level, get_shared_logging_handle, init_shared_logging_handle, tokio_console_active,
    SharedLoggingHandle,
};

use actix_web::rt::spawn;
use actix_web::web::Data;
use config::{get_sequencer_and_feed_configs, AllFeedsConfig, SequencerConfig};
use prometheus::metrics::FeedsMetrics;
use sequencer::feeds::feed_allocator::{init_concurrent_allocator, ConcurrentAllocator};
use sequencer::feeds::feed_workers::prepare_app_workers;
use sequencer::http_handlers::admin::metrics;
use std::env;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio::task::JoinHandle;

use utils::build_info::{
    BLOCKSENSE_VERSION, GIT_BRANCH, GIT_DIRTY, GIT_HASH, GIT_HASH_SHORT, GIT_TAG,
    VERGEN_CARGO_DEBUG, VERGEN_CARGO_FEATURES, VERGEN_CARGO_OPT_LEVEL, VERGEN_RUSTC_SEMVER,
};

type VoteChannel = (
    UnboundedSender<(String, String)>,
    UnboundedReceiver<(String, String)>,
);

/// Given a Sequencer config is returns the app state need to start the Actix Sequencer server.
pub async fn prepare_sequencer_state(
    sequencer_config: &SequencerConfig,
    feeds_config: AllFeedsConfig,
    metrics_prefix: Option<&str>,
) -> (
    UnboundedReceiver<(String, String)>,
    UnboundedReceiver<FeedsSlotsManagerCmds>,
    Data<SequencerState>,
) {
    let log_handle: SharedLoggingHandle = get_shared_logging_handle();

    tokio::spawn(async move {
        tokio::signal::ctrl_c().await.unwrap();
        std::process::exit(0);
    });

    let providers = init_shared_rpc_providers(sequencer_config, metrics_prefix).await;
    let feed_id_allocator: ConcurrentAllocator = init_concurrent_allocator();
    let (vote_send, vote_recv): VoteChannel = mpsc::unbounded_channel();
    let (feeds_slots_manager_cmd_send, feeds_slots_manager_cmd_recv) = mpsc::unbounded_channel();

    let sequencer_state: Data<SequencerState> = web::Data::new(SequencerState {
        registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_from_config(
            &feeds_config,
        ))),
        reports: Arc::new(RwLock::new(AllFeedsReports::new())),
        providers: providers.clone(),
        log_handle,
        reporters: init_shared_reporters(sequencer_config, metrics_prefix),
        feed_id_allocator: Arc::new(RwLock::new(Some(feed_id_allocator))),
        voting_send_channel: vote_send,
        feeds_metrics: Arc::new(RwLock::new(
            FeedsMetrics::new(metrics_prefix.unwrap_or(""))
                .expect("Failed to allocate feed_metrics"),
        )),
        feeds_config: Arc::new(RwLock::new(feeds_config)),
        sequencer_config: Arc::new(RwLock::new(sequencer_config.clone())),
        feed_aggregate_history: Arc::new(RwLock::new(FeedAggregateHistory::new())),
        feeds_slots_manager_cmd_send,
    });

    (vote_recv, feeds_slots_manager_cmd_recv, sequencer_state)
}

pub async fn prepare_http_servers(
    sequencer_state: Data<SequencerState>,
    sequencer_config_main_port: u16,
    admin_port: u16,
) -> (
    JoinHandle<std::io::Result<()>>,
    JoinHandle<std::io::Result<()>>,
) {
    let main_sequencer_state: Data<SequencerState> = sequencer_state.clone();
    let main_http_server_fut: JoinHandle<std::io::Result<()>> = spawn(async move {
        HttpServer::new(move || {
            App::new()
                .app_data(main_sequencer_state.clone())
                .service(post_report)
                .service(post_reports_batch)
        })
        .bind(("0.0.0.0", sequencer_config_main_port))
        .expect("Main HTTP server could not bind to port.")
        .run()
        .await
    });

    let admin_sequencer_state: Data<SequencerState> = sequencer_state.clone();
    let admin_http_server_fut: JoinHandle<std::io::Result<()>> = spawn(async move {
        HttpServer::new(move || {
            App::new()
                .app_data(admin_sequencer_state.clone())
                .service(get_key)
                .service(deploy)
                .service(set_log_level)
                .service(get_feed_report_interval)
                .service(register_feed)
                .service(get_feeds_config)
                .service(get_feed_config)
                .service(get_sequencer_config)
                .service(register_asset_feed)
        })
        .workers(1)
        .bind(("0.0.0.0", admin_port))
        .expect("Admin HTTP server could not bind to port.")
        .run()
        .await
    });

    (main_http_server_fut, admin_http_server_fut)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let mut start_metrics_server = true;

    let mut args = env::args().skip(1);
    while let Some(arg) = args.next() {
        match &arg[..] {
            "-c" | "--config-file-path" => {
                if let Some(arg_config) = args.next() {
                    env::set_var("SEQUENCER_CONFIG_DIR", arg_config);
                } else {
                    panic!("No value specified for parameter --config-file-path.");
                }
            }
            "--no-metrics-server" => {
                start_metrics_server = false;
            }
            "--no-tokio-console" => {
                env::set_var("SEQUENCER_TOKIO_CONSOLE", "false");
            }
            "--validate-config" => {
                init_shared_logging_handle("INFO", false);
                println!("Validating configuration for version:");
                println!("version => {BLOCKSENSE_VERSION}");
                println!("git_hash => {GIT_HASH}");
                println!("git_hash_short => {GIT_HASH_SHORT}");
                println!("git_dirty => {GIT_DIRTY}");
                println!("git_branch => {GIT_BRANCH}");
                println!("git_tag => {GIT_TAG}");
                println!("debug => {VERGEN_CARGO_DEBUG}");
                println!("features => {VERGEN_CARGO_FEATURES}");
                println!("optimizations => {VERGEN_CARGO_OPT_LEVEL}");
                println!("compiler => {VERGEN_RUSTC_SEMVER}");

                get_sequencer_and_feed_configs();

                return std::io::Result::Ok(());
            }
            "--help" => {
                println!("Usage:");
                println!("sequencer [options] [args]");
                println!(" ");
                println!("OPTIONS");
                println!("--help                     show list of command-line options");
                println!("-c, --config-file-path     specify sequencer's config file path");
                println!("--no-metrics-server        do not start prometheus metric server");
                println!("--validate-config          validate configuration, print used config files paths and terminate");

                return Ok(());
            }
            _ => {
                if arg.starts_with('-') {
                    println!("Unknown argument {}", arg);
                } else {
                    println!("Unknown positional argument {}", arg);
                }
            }
        }
    }
    init_shared_logging_handle(
        get_log_level("SEQUENCER").as_str(),
        tokio_console_active("SEQUENCER"),
    );

    let (sequencer_config, feeds_config) = get_sequencer_and_feed_configs();

    let (voting_receive_channel, feeds_slots_manager_cmd_recv, sequencer_state) =
        prepare_sequencer_state(&sequencer_config, feeds_config, None).await;

    let collected_futures = prepare_app_workers(
        sequencer_state.clone(),
        &sequencer_config,
        voting_receive_channel,
        feeds_slots_manager_cmd_recv,
    )
    .await;

    let (main_http_server_fut, admin_http_server_fut) = prepare_http_servers(
        sequencer_state,
        sequencer_config.main_port,
        sequencer_config.admin_port,
    )
    .await;

    collected_futures.push(main_http_server_fut);
    collected_futures.push(admin_http_server_fut);

    if start_metrics_server {
        let prometheus_http_server_fut = spawn(async move {
            HttpServer::new(move || App::new().service(metrics))
                .workers(1)
                .bind(("0.0.0.0", sequencer_config.prometheus_port))
                .expect("Prometheus HTTP server could not bind to port.")
                .run()
                .await
        });
        collected_futures.push(prometheus_http_server_fut);
    }

    let result = futures::future::join_all(collected_futures).await;
    for v in result {
        match v {
            Ok(res) => match res {
                Ok(x) => x,
                Err(e) => {
                    panic!("TaskError: {}", e);
                }
            },
            Err(e) => {
                panic!("JoinError: {} ", e);
            }
        }
    }

    Ok(())
}
