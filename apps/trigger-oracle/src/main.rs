use anyhow::Error;
use clap::Parser;
use serde::Deserialize;
use spin_trigger::cli::TriggerExecutorCommand;
use std::io::IsTerminal;
use trigger_oracle::OracleTrigger;

type Command = TriggerExecutorCommand<OracleTrigger>;

use std::time::Duration;
use tokio::task::{JoinHandle, LocalSet};

use actix_web::{post, web, App, HttpResponse, HttpServer, Responder};
use futures::future::join_all;
use futures_util::stream::FuturesUnordered;

#[derive(Debug, Deserialize)]
struct Params {
    seconds: u64,
    endpoint_url: String,
    #[serde(default = "default_getter")]
    request_method: String,
}

fn default_getter() -> String {
    "GET".to_owned()
}

#[post("/")]
async fn timed_out_request(payload: web::Payload) -> impl Responder {
    // payload is a stream of Bytes objects
    let payload = match payload.to_bytes().await {
        Ok(bytes) => serde_json::from_slice::<Params>(&bytes).unwrap(),
        Err(e) => {
            let err_msg = format!("Error parsing body: {e}");
            tracing::error!(err_msg);
            return HttpResponse::BadRequest().body(err_msg);
        }
    };

    let endpoint_url = &payload.endpoint_url;

    let client = reqwest::Client::new();
    let response = match payload.request_method.as_str() {
        "POST" => match actix_web::rt::time::timeout(
            Duration::from_secs(payload.seconds),
            client.post(endpoint_url).send(),
        )
        .await
        {
            Ok(resp_result) => match resp_result {
                Ok(r) => r,
                Err(e) => {
                    let err_msg =
                        format!("failed to get response for POST request to {endpoint_url}: {e}");
                    tracing::error!(err_msg);
                    return HttpResponse::BadRequest().body(err_msg);
                }
            },
            Err(e) => {
                let err_msg =
                    format!("failed to get response for POST request to {endpoint_url}: {e}");
                tracing::error!(err_msg);
                return HttpResponse::BadRequest().body(err_msg);
            }
        },
        _ =>
        // Make a GET request
        {
            match actix_web::rt::time::timeout(
                Duration::from_secs(payload.seconds),
                client.get(&payload.endpoint_url).send(),
            )
            .await
            {
                Ok(resp_result) => match resp_result {
                    Ok(r) => r,
                    Err(e) => {
                        let err_msg = format!(
                            "failed to get response for GET request to {endpoint_url}: {e}"
                        );
                        tracing::error!(err_msg);
                        return HttpResponse::BadRequest().body(err_msg);
                    }
                },
                Err(e) => {
                    let err_msg =
                        format!("failed to get response for GET request to {endpoint_url}: {e}");
                    tracing::error!(err_msg);
                    return HttpResponse::BadRequest().body(err_msg);
                }
            }
        }
    };

    let body = match response.bytes().await {
        Ok(val) => val,
        Err(e) => {
            let err_msg = format!("Failed to convert response to bytes from {endpoint_url}: {e}");
            tracing::error!(err_msg);
            return HttpResponse::BadRequest().body(err_msg);
        }
    };

    // Return empty 200 OK
    HttpResponse::Ok().body(body)
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
