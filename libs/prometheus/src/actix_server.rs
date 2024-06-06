use std::sync::Mutex;

use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder};
use prometheus::TextEncoder;
use reqwest::Client;
use utils::get_env_var;

use crate::AppState;

#[post("/push")]
async fn push_to_buffer(data: web::Data<AppState>, body: String) -> impl Responder {
    let mut buffer = data.buffer.lock().unwrap();
    buffer.clear();
    buffer.push_str(&body);
    HttpResponse::Ok().body(format!("Buffer updated: {}", buffer))
}

#[get("/pull")]
async fn pull_buffer(data: web::Data<AppState>) -> impl Responder {
    let buffer = data.buffer.lock().unwrap();
    HttpResponse::Ok().body(buffer.clone())
}

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

    let metric_families = prometheus::gather();
    encoder.encode_utf8(&metric_families, &mut buffer).unwrap();

    let _ = client
        .post(format!("{}{}/push", "http://", url))
        .body(buffer.to_string())
        .send()
        .await?;

    Ok(())
}
