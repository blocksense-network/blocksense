use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder};
use data_feeds::utils::get_env_var;
use std::sync::Mutex;

struct AppState {
    buffer: Mutex<String>,
}

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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
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
