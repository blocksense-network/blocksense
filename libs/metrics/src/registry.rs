use actix_web::{get, post, web, HttpResponse, Responder};

use crate::AppState;

#[post("/metrics/job/reporter")]
async fn push_to_buffer(data: web::Data<AppState>, body: String) -> impl Responder {
    let mut buffer = data.buffer.lock().unwrap();
    buffer.clear();
    buffer.push_str(&body);
    HttpResponse::Ok().body(format!("Buffer updated: {buffer}"))
}

#[get("/pull")]
async fn pull_buffer(data: web::Data<AppState>) -> impl Responder {
    let buffer = data.buffer.lock().unwrap();
    HttpResponse::Ok().body(buffer.clone())
}
