use anyhow::{Context, Error};
use clap::Parser;
use spin_trigger::cli::TriggerExecutorCommand;
use std::io::IsTerminal;
use trigger_oracle::{OracleTrigger, Params};

type Command = TriggerExecutorCommand<OracleTrigger>;

use std::str::FromStr;
use std::time::Duration;
use tokio::task::{JoinHandle, LocalSet};

use actix_web::{post, web, App, HttpRequest, HttpResponse, HttpServer, Responder};
use futures::future::join_all;
use futures_util::stream::FuturesUnordered;

use reqwest::header as reqwest_header;

#[post("/")]
async fn timing_out_request(req: HttpRequest, payload: web::Payload) -> impl Responder {
    // payload is a stream of Bytes objects
    let payload = match payload.to_bytes().await {
        Ok(bytes) => serde_json::from_slice::<Params>(&bytes).unwrap(),
        Err(e) => {
            let err_msg = format!("Error parsing body: {e}");
            tracing::error!(err_msg);
            return HttpResponse::BadRequest().body(err_msg);
        }
    };

    let headers = req.headers();

    let mut reqwest_headers = reqwest_header::HeaderMap::new();

    for (key, value) in headers.iter() {
        if key == "host" {
            continue;
        }
        if key == "Allowed-Hosts" {
            let mut allowed = false;
            let allowed_hosts: Vec<String> = value
                .to_str()
                .unwrap()
                .split("|")
                .map(|s| s.to_string())
                .collect();
            for allowed_host in allowed_hosts {
                if payload.endpoint_url.contains(allowed_host.as_str()) {
                    allowed = true;
                    break;
                }
            }
            if !allowed {
                tracing::error!("To allow requests, add 'allowed_outbound_hosts = [\"{}\"]' to the manifest component section.", payload.endpoint_url);
                let err_msg = format!("Destination not allowed: {}", payload.endpoint_url);
                tracing::error!(err_msg);
                return HttpResponse::BadRequest().body(err_msg);
            }
            continue;
        }
        reqwest_headers.insert(
            match reqwest_header::HeaderName::from_str(key.as_str()) {
                Ok(header) => header,
                Err(e) => {
                    let err_msg = format!("Error parsing header key {key}: {e}");
                    tracing::error!(err_msg);
                    return HttpResponse::BadRequest().body(err_msg);
                }
            },
            match reqwest_header::HeaderValue::from_bytes(value.as_bytes()) {
                Ok(val) => val,
                Err(e) => {
                    let err_msg = format!("Error parsing header value {value:?}: {e}");
                    tracing::error!(err_msg);
                    return HttpResponse::BadRequest().body(err_msg);
                }
            },
        );
    }

    let endpoint_url = &payload.endpoint_url;

    let client = reqwest::Client::new();
    let response = match payload.request_method.as_str() {
        "POST" => {
            let mut send_future = client.post(endpoint_url).headers(reqwest_headers);
            if let Some(body) = payload.request_body {
                send_future = send_future.body(body);
            }
            match actix_web::rt::time::timeout(
                Duration::from_secs(payload.seconds),
                send_future.send(),
            )
            .await
            {
                Ok(resp_result) => match resp_result {
                    Ok(r) => r,
                    Err(e) => {
                        let err_msg = format!(
                            "failed to get response for POST request to {endpoint_url}: {e}"
                        );
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
            }
        }
        _ =>
        // Make a GET request
        {
            match actix_web::rt::time::timeout(
                Duration::from_secs(payload.seconds),
                client.get(endpoint_url).headers(reqwest_headers).send(),
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

            let timing_out_server_runner_fut: JoinHandle<anyhow::Result<()>> =
                tokio::task::Builder::new()
                    .name("timing_out_server_runner")
                    .spawn(async move {
                        tracing::info!("Starting timing out server on port 3000 ...");
                        HttpServer::new(|| App::new().service(timing_out_request))
                            .bind("127.0.0.1:3000")
                            .expect("Could not start timing out server on port 3000")
                            .run()
                            .await
                            .context("Failed timing out server")
                    })
                    .expect("Failed to spawn timing_out server!");

            runners.push(timing_out_server_runner_fut);

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
