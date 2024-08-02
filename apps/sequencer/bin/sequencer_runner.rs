use std::sync::{Arc, RwLock};

use actix_web::{web, App, HttpServer};
use feed_registry::registry::{new_feeds_meta_data_reg_from_config, AllFeedsReports};
use sequencer::feeds::feeds_slots_manager;
use sequencer::feeds::feeds_state::FeedsState;
use sequencer::providers::provider::{init_shared_rpc_providers, SharedRpcProviders};
use tokio::sync::mpsc;

use sequencer::reporters::reporter::init_shared_reporters;

use sequencer::http_handlers::admin::{deploy, get_feed_report_interval, get_key, set_log_level};
use sequencer::http_handlers::data_feeds::{post_report, register_feed};
use sequencer::metrics_collector::metrics_collector::metrics_collector_loop;
use utils::logging::{init_shared_logging_handle, SharedLoggingHandle};

use actix_web::rt::spawn;
use actix_web::web::Data;
use sequencer::config::config::init_sequencer_config;
use sequencer::feeds::feed_allocator::{init_concurrent_allocator, ConcurrentAllocator};
use sequencer::feeds::feed_workers::prepare_app_workers;
use sequencer::http_handlers::admin::metrics;
use sequencer_config::SequencerConfig;
use std::env;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio::task::JoinHandle;

/// Given a Sequencer config is returns the app state need to start the Actix Sequencer server.
pub async fn prepare_app_state(
    sequencer_config: &SequencerConfig,
) -> (UnboundedReceiver<(String, String)>, Data<FeedsState>) {
    let log_handle: SharedLoggingHandle = init_shared_logging_handle();

    tokio::spawn(async move {
        tokio::signal::ctrl_c().await.unwrap();
        std::process::exit(0);
    });

    let providers = init_shared_rpc_providers(&sequencer_config, None).await;
    let feed_id_allocator: ConcurrentAllocator = init_concurrent_allocator();
    let (vote_send, vote_recv): (
        UnboundedSender<(String, String)>,
        UnboundedReceiver<(String, String)>,
    ) = mpsc::unbounded_channel();

    let app_state: Data<FeedsState> = web::Data::new(FeedsState {
        registry: Arc::new(RwLock::new(new_feeds_meta_data_reg_from_config(
            sequencer_config,
        ))),
        reports: Arc::new(RwLock::new(AllFeedsReports::new())),
        providers: providers.clone(),
        log_handle,
        reporters: init_shared_reporters(&sequencer_config, None),
        feed_id_allocator: Arc::new(RwLock::new(Some(feed_id_allocator))),
        voting_send_channel: vote_send,
    });

    (vote_recv, app_state)
}

pub async fn prepare_http_servers(
    app_state: Data<FeedsState>,
    sequencer_config_main_port: u16,
    admin_port: u16,
) -> (
    JoinHandle<std::io::Result<()>>,
    JoinHandle<std::io::Result<()>>,
) {
    let main_app_state: Data<FeedsState> = app_state.clone();
    let main_http_server_fut: JoinHandle<std::io::Result<()>> = spawn(async move {
        HttpServer::new(move || {
            App::new()
                .app_data(main_app_state.clone())
                .service(post_report)
        })
        .bind(("0.0.0.0", sequencer_config_main_port))
        .expect("Main HTTP server could not bind to port.")
        .run()
        .await
    });

    let admin_app_state: Data<FeedsState> = app_state.clone();
    let admin_http_server_fut: JoinHandle<std::io::Result<()>> = spawn(async move {
        HttpServer::new(move || {
            App::new()
                .app_data(admin_app_state.clone())
                .service(get_key)
                .service(deploy)
                .service(set_log_level)
                .service(get_feed_report_interval)
                .service(register_feed)
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
            "--help" => {
                println!(
                    "Usage:
sequencer [options] [args]

OPTIONS
  --help                     show list of command-line options
  -c, --config-file-path     specify sequencer's config file path
  --no-metrics-server        do not start prometheus metric server"
                );
                return Ok({});
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

    let sequencer_config: SequencerConfig = init_sequencer_config();
    let (voting_receive_channel, app_state): (
        UnboundedReceiver<(String, String)>,
        Data<FeedsState>,
    ) = prepare_app_state(&sequencer_config).await;

    let collected_futures =
        prepare_app_workers(app_state.clone(), &sequencer_config, voting_receive_channel).await;

    let (main_http_server_fut, admin_http_server_fut) = prepare_http_servers(
        app_state,
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
                    panic!("TaskError: {}", e.to_string());
                }
            },
            Err(e) => {
                panic!("JoinError: {} ", e.to_string());
            }
        }
    }

    Ok(())
}
