use anyhow::Error;
use clap::Parser;
use spin_trigger::cli::TriggerExecutorCommand;
use std::io::IsTerminal;
use trigger_oracle::OracleTrigger;

type Command = TriggerExecutorCommand<OracleTrigger>;

use actix_web::{get, web, App, HttpServer, Responder};
use std::time::Duration;
use tokio::{
    task::{JoinHandle, LocalSet},
    time::sleep,
};

use futures::future::join_all;
use futures_util::stream::FuturesUnordered;

#[get("/")]
async fn timed_out_request(
    query: web::Query<std::collections::HashMap<String, u64>>,
) -> impl Responder {
    // Get the `seconds` parameter, default to 0
    let seconds = query.get("seconds").cloned().unwrap_or(0);

    // Delay asynchronously
    if seconds > 0 {
        sleep(Duration::from_secs(seconds)).await;
    }

    // Return empty 200 OK
    ""
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    // LocalSet is required for spawn_local
    let local = LocalSet::new();

    local
        .run_until(async move {
            let runners: FuturesUnordered<JoinHandle<anyhow::Result<(), Error>>> =
                FuturesUnordered::new();

            let trigger_executor_fut: JoinHandle<anyhow::Result<()>> = tokio::task::Builder::new()
                .name("trigger_executor")
                .spawn_local(async move {
                    tracing::info!("Starting trigger executor ...");

                    tracing_subscriber::fmt()
                        .with_writer(std::io::stderr)
                        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
                        .with_ansi(std::io::stderr().is_terminal())
                        .init();

                    let t = Command::parse();
                    t.run().await
                })
                .expect("Failed to spawn trigger_executor server!");

            runners.push(trigger_executor_fut);

            let timed_out_server_runner_fut: JoinHandle<anyhow::Result<()>> =
                tokio::task::Builder::new()
                    .name("timed_out_server_runner")
                    .spawn(async move {
                        tracing::info!("Starting timed out server on port 3000 ...");
                        match HttpServer::new(|| App::new().service(timed_out_request))
                            .bind("127.0.0.1:3000")
                            .expect("Could not start timed out server on port 3000")
                            .run()
                            .await
                        {
                            Ok(v) => Ok(v),
                            Err(e) => Err(anyhow::anyhow!(e.to_string())),
                        }
                    })
                    .expect("Failed to spawn timed_out server!");

            runners.push(timed_out_server_runner_fut);

            // Wait for all
            let results = join_all(runners).await;
            for res in results {
                if let Err(e) = res {
                    eprintln!("Task error: {e}");
                }
            }

            Ok(())
        })
        .await
}
