use std::sync::Mutex;

use actix_web::{web, App, HttpServer};
use blocksense_utils::get_env_var;
use prometheus::TextEncoder;
use reqwest::Client;

use crate::{metrics::BUILD_INFO, registry::push_to_buffer, AppState};

pub async fn run_actix_server() -> std::io::Result<()> {
    let sequencer_state = web::Data::new(AppState {
        buffer: Mutex::new(String::new()),
    });

    HttpServer::new(move || {
        App::new()
            .app_data(sequencer_state.clone())
            .service(push_to_buffer)
    })
    .bind(
        get_env_var::<String>("PROMETHEUS_URL_SERVER")
            .unwrap_or("http://0.0.0.0:9091/metrics/job/reporter".to_string()),
    )?
    .run()
    .await
}

pub async fn handle_prometheus_metrics(
    client: &Client,
    url: &str,
    encoder: &TextEncoder,
) -> Result<(), anyhow::Error> {
    let mut buffer = String::new();

    BUILD_INFO.set(1);

    let metric_families = prometheus::gather();
    encoder.encode_utf8(&metric_families, &mut buffer).unwrap();

    let _ = client
        .post(url.to_string())
        .body(buffer.to_string())
        .send()
        .await?;

    Ok(())
}
