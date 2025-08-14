use anyhow::Error;
use clap::Parser;
use spin_trigger::cli::TriggerExecutorCommand;
use std::io::IsTerminal;
use trigger_oracle::OracleTrigger;

type Command = TriggerExecutorCommand<OracleTrigger>;

use actix_web::{get, web, App, HttpServer, Responder};
use std::time::Duration;
use tokio::task::{JoinHandle, LocalSet};

use actix_web::HttpResponse;
use futures::future::join_all;
use futures_util::stream::FuturesUnordered;

#[get("/")]
async fn timed_out_request(
    query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    // Get the `seconds` parameter, default to 0
    let seconds = match query.get("seconds") {
        Some(val) => match val.clone().parse::<u64>() {
            Ok(val) => val,
            Err(e) => {
                let err_msg = format!("Error parsing seconds to u64: {e}");
                tracing::error!(err_msg);
                return HttpResponse::BadRequest().body(err_msg);
            }
        },
        None => {
            let err_msg = "Missing `seconds` parameter";
            tracing::error!(err_msg);
            return HttpResponse::BadRequest().body(err_msg);
        }
    };

    let request_method = match query.get("request_method") {
        Some(val) => val.clone(),
        None => {
            return HttpResponse::BadRequest().body("Missing `request_method` parameter");
        }
    };

    let url = match query.get("url") {
        Some(val) => val.clone(),
        None => {
            return HttpResponse::BadRequest().body("Missing `url` parameter");
        }
    };

    let client = reqwest::Client::new();
    let response = match request_method.as_str() {
        "POST" => match actix_web::rt::time::timeout(
            Duration::from_secs(seconds),
            client.post(&url).send(),
        )
        .await
        {
            Ok(resp_result) => match resp_result {
                Ok(r) => r,
                Err(e) => {
                    return HttpResponse::BadRequest().body(format!(
                        "failed to get response for POST request to {url}: {e}"
                    ))
                }
            },
            Err(e) => {
                return HttpResponse::BadRequest().body(format!(
                    "failed to get response for POST request to {url}: {e}"
                ))
            }
        },
        _ =>
        // Make a GET request
        {
            match actix_web::rt::time::timeout(
                Duration::from_secs(seconds),
                client.get(&url).send(),
            )
            .await
            {
                Ok(resp_result) => match resp_result {
                    Ok(r) => r,
                    Err(e) => {
                        return HttpResponse::BadRequest().body(format!(
                            "failed to get response for GET request to {url}: {e}"
                        ))
                    }
                },
                Err(e) => {
                    return HttpResponse::BadRequest().body(format!(
                        "failed to get response for GET request to {url}: {e}"
                    ))
                }
            }
        }
    };

    let body = match response.bytes().await {
        Ok(val) => val,
        Err(e) => {
            return HttpResponse::BadRequest()
                .body(format!("Failed to convert response to bytes: {e}"))
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
