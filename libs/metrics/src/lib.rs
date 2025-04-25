use std::sync::Mutex;

pub mod actix_server;
pub mod metrics;
pub mod metrics_collector;
pub mod registry;

pub use prometheus::TextEncoder;

struct AppState {
    buffer: Mutex<String>,
}
