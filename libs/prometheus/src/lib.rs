use std::sync::Mutex;

pub mod actix_server;
pub mod metrics;

pub use prometheus::TextEncoder;

struct AppState {
    buffer: Mutex<String>,
}
