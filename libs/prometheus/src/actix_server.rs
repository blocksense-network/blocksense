use std::sync::Mutex;

use actix_web::{web, App, HttpServer};
use prometheus_framework::TextEncoder;
use reqwest::Client;
use utils::get_env_var;

use crate::{
    registry::{pull_buffer, push_to_buffer},
    AppState,
};

pub async fn run_actix_server() -> std::io::Result<()> {
    let app_state = web::Data::new(AppState {
        buffer: Mutex::new(String::new()),
    });

    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .service(push_to_buffer)
            .service(pull_buffer)
    })
    .bind(get_env_var::<String>("PROMETHEUS_URL_SERVER").unwrap_or("0.0.0.0:8080".to_string()))?
    .run()
    .await
}

pub async fn handle_prometheus_metrics(
    client: &Client,
    url: &str,
    encoder: &TextEncoder,
) -> Result<(), anyhow::Error> {
    let mut buffer = String::new();

    let metric_families = prometheus_framework::gather();
    encoder.encode_utf8(&metric_families, &mut buffer).unwrap();

    let _ = client
        .post(format!("{}{}/push", "http://", url))
        .body(buffer.to_string())
        .send()
        .await?;

    Ok(())
}
