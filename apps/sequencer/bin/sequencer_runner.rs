use actix_web::{web, App, HttpServer};
use blocksense_feed_registry::feed_registration_cmds::FeedsManagementCmds;
use blocksense_gnosis_safe::data_types::ReporterResponse;
use blocksense_gnosis_safe::utils::SignatureWithAddress;
use blocksense_utils::counter_unbounded_channel::CountedReceiver;
#[cfg(feature = "profile")]
use pprof::ProfilerGuard;
use sequencer::providers::eth_send_utils::BatchOfUpdatesToProcess;
use sequencer::providers::provider::init_shared_rpc_providers;
use sequencer::pyroscope_profiler::setup_pyroscope;
use sequencer::sequencer_state::{create_relayers_channels, SequencerState};
use tokio::sync::{mpsc, RwLock};

use blocksense_utils::logging::{
    get_log_level, get_shared_logging_handle, init_shared_logging_handle, tokio_console_active,
    SharedLoggingHandle,
};
use sequencer::http_handlers::admin::add_admin_services;
use sequencer::http_handlers::data_feeds::add_main_services;

use actix_web::web::Data;
use blocksense_config::{get_sequencer_and_feed_configs, AllFeedsConfig, SequencerConfig};
use sequencer::feeds::feed_workers::prepare_app_workers;
use sequencer::http_handlers::admin::metrics;
use std::collections::HashMap;
use std::env;
use std::sync::Arc;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio::task::JoinHandle;
use tracing::info;

use blocksense_utils::build_info::{
    BLOCKSENSE_VERSION, GIT_BRANCH, GIT_DIRTY, GIT_HASH, GIT_HASH_SHORT, GIT_TAG,
    VERGEN_CARGO_DEBUG, VERGEN_CARGO_FEATURES, VERGEN_CARGO_OPT_LEVEL, VERGEN_RUSTC_SEMVER,
};

use blocksense_data_feeds::feeds_processing::VotedFeedUpdateWithProof;

type VoteChannel = (
    UnboundedSender<VotedFeedUpdateWithProof>,
    UnboundedReceiver<VotedFeedUpdateWithProof>,
);

/// Given a Sequencer config is returns the app state need to start the Actix Sequencer server.
pub async fn prepare_sequencer_state(
    sequencer_config: &SequencerConfig,
    feeds_config: AllFeedsConfig,
    metrics_prefix: Option<&str>,
) -> (
    UnboundedReceiver<VotedFeedUpdateWithProof>, // aggregated_votes_to_block_creator_recv
    UnboundedReceiver<FeedsManagementCmds>,      // feeds_management_cmd_to_block_creator_recv
    UnboundedReceiver<FeedsManagementCmds>,      // feeds_slots_manager_cmd_recv
    UnboundedReceiver<(ReporterResponse, SignatureWithAddress)>, // aggregate_batch_sig_recv
    HashMap<String, CountedReceiver<BatchOfUpdatesToProcess>>, // relayers_recv_channels
    Data<SequencerState>,
) {
    let log_handle: SharedLoggingHandle = get_shared_logging_handle();

    tokio::task::Builder::new()
        .name("interrupt_watcher")
        .spawn(async move {
            info!("Watching for Ctrl-C...");
            tokio::signal::ctrl_c().await.unwrap();
            info!("Ctrl-C detected; terminating...");
            std::process::exit(0);
        })
        .expect("Failed to spawn interrupt watcher!");

    let providers =
        init_shared_rpc_providers(sequencer_config, metrics_prefix, &feeds_config).await;

    let (relayers_send_channels, relayers_recv_channels) =
        create_relayers_channels(&providers).await;

    let (aggregated_votes_to_block_creator_send, aggregated_votes_to_block_creator_recv): VoteChannel = mpsc::unbounded_channel();
    let (feeds_management_cmd_to_block_creator_send, feeds_management_cmd_to_block_creator_recv) =
        mpsc::unbounded_channel();
    let (feeds_slots_manager_cmd_send, feeds_slots_manager_cmd_recv) = mpsc::unbounded_channel();
    let (aggregate_batch_sig_send, aggregate_batch_sig_recv) = mpsc::unbounded_channel();

    let sequencer_state: Data<SequencerState> = web::Data::new(SequencerState::new(
        feeds_config,
        providers,
        log_handle,
        sequencer_config,
        metrics_prefix,
        aggregated_votes_to_block_creator_send,
        feeds_management_cmd_to_block_creator_send,
        feeds_slots_manager_cmd_send,
        aggregate_batch_sig_send,
        Arc::new(RwLock::new(relayers_send_channels)),
    ));

    (
        aggregated_votes_to_block_creator_recv,
        feeds_management_cmd_to_block_creator_recv,
        feeds_slots_manager_cmd_recv,
        aggregate_batch_sig_recv,
        relayers_recv_channels,
        sequencer_state,
    )
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
    let main_http_server_fut: JoinHandle<std::io::Result<()>> = tokio::task::Builder::new()
        .name("main_http_server")
        .spawn(async move {
            info!("Starting main HTTP server on port {sequencer_config_main_port}...");
            HttpServer::new(move || {
                App::new()
                    .app_data(main_sequencer_state.clone())
                    .configure(add_main_services)
            })
            .bind(("0.0.0.0", sequencer_config_main_port))
            .expect("Main HTTP server could not bind to port.")
            .run()
            .await
        })
        .expect("Failed to spawn main HTTP server!");

    let admin_sequencer_state: Data<SequencerState> = sequencer_state.clone();
    let admin_http_server_fut: JoinHandle<std::io::Result<()>> = tokio::task::Builder::new()
        .name("admin_http_server")
        .spawn(async move {
            info!("Starting admin HTTP server on port {admin_port}...");
            HttpServer::new(move || {
                App::new()
                    .app_data(admin_sequencer_state.clone())
                    .configure(add_admin_services)
            })
            .workers(1)
            .bind(("0.0.0.0", admin_port))
            .expect("Admin HTTP server could not bind to port.")
            .run()
            .await
        })
        .expect("Failed to spawn admin HTTP server!");

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
                    println!("Unknown argument {arg}");
                } else {
                    println!("Unknown positional argument {arg}");
                }
            }
        }
    }
    init_shared_logging_handle(
        get_log_level("SEQUENCER").as_str(),
        tokio_console_active("SEQUENCER"),
    );

    let (sequencer_config, feeds_config) = get_sequencer_and_feed_configs();

    let agent_opt = setup_pyroscope(&sequencer_config).await;
    let _agent_running =
        agent_opt.map(|agent| agent.start().expect("Could not start PyroscopeAgent!"));

    let (
        aggregated_votes_to_block_creator_recv,
        feeds_management_cmd_to_block_creator_recv,
        feeds_slots_manager_cmd_recv,
        aggregate_batch_sig_recv,
        relayers_recv_channels,
        sequencer_state,
    ) = prepare_sequencer_state(&sequencer_config, feeds_config, None).await;

    let collected_futures = prepare_app_workers(
        sequencer_state.clone(),
        &sequencer_config,
        aggregated_votes_to_block_creator_recv,
        feeds_management_cmd_to_block_creator_recv,
        feeds_slots_manager_cmd_recv,
        aggregate_batch_sig_recv,
        relayers_recv_channels,
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
        let prometheus_http_server_fut = tokio::task::Builder::new()
            .name("prometheus_http_server")
            .spawn(async move {
                let port = sequencer_config.prometheus_port;
                info!("Starting prometheus HTTP server on port {port}...");
                HttpServer::new(move || App::new().service(metrics))
                    .workers(1)
                    .bind(("0.0.0.0", port))
                    .expect("Prometheus HTTP server could not bind to port.")
                    .run()
                    .await
            })
            .expect("Failed to spawn prometheus server!");
        collected_futures.push(prometheus_http_server_fut);
    }

    #[cfg(feature = "profile")]
    let guard = ProfilerGuard::new(1000).unwrap();
    #[cfg(feature = "profile")]
    collected_futures.push(
        tokio::task::Builder::new()
            .name("prof_task")
            .spawn(async move {
                loop {
                    let time_to_await = std::time::Duration::from_secs(10 * 60);
                    let mut interval = tokio::time::interval(time_to_await);
                    interval.tick().await;
                    // The first tick completes immediately.
                    interval.tick().await;
                    info!("Producing Flamegraph ...");
                    if let Ok(report) = guard.report().build() {
                        let timestamp =
                            chrono::Local::now().format("%Y-%m-%d_%H:%M:%S").to_string();
                        let filename = format!("flamegraph_{timestamp}.svg");
                        let file = std::fs::File::create(filename.as_str())
                            .expect("Could not create {filename}");
                        report
                            .flamegraph(file)
                            .expect("Could not write data to {filename}");
                        info!("Flamegraph written to {filename}");
                    } else {
                        tracing::error!("Error writing Flamegraph to flamegraph.svg");
                    }
                }
            })
            .expect("Failed to spawn profiling task!"),
    );

    let result = futures::future::join_all(collected_futures).await;
    for v in result {
        match v {
            Ok(res) => match res {
                Ok(x) => x,
                Err(e) => {
                    panic!("TaskError: {e}");
                }
            },
            Err(e) => {
                panic!("JoinError: {e} ");
            }
        }
    }

    Ok(())
}
