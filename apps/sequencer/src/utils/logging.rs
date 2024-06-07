use std::env;
use std::sync::Arc;
use std::sync::Mutex;
use tracing_subscriber::filter::LevelFilter;
use tracing_subscriber::{filter, fmt, prelude::*, reload, Registry};

type Handle = tracing_subscriber::reload::Handle<LevelFilter, Registry>;
pub type SharedLoggingHandle = Arc<Mutex<LoggingHandle>>;

pub fn init_shared_logging_handle() -> Arc<Mutex<LoggingHandle>> {
    Arc::new(Mutex::new(init_logging_handle()))
}

fn str_to_filter_level(log_level: &str) -> Option<LevelFilter> {
    match log_level {
        "TRACE" => Some(filter::LevelFilter::TRACE),
        "DEBUG" => Some(filter::LevelFilter::DEBUG),
        "INFO" => Some(filter::LevelFilter::INFO),
        "WARN" => Some(filter::LevelFilter::WARN),
        "ERROR" => Some(filter::LevelFilter::ERROR),
        _ => None,
    }
}

pub fn init_logging_handle() -> LoggingHandle {
    let filter = match env::var("SEQUENCER_LOGGING_LEVEL") {
        Ok(logging_level) => match str_to_filter_level(logging_level.as_str()) {
            Some(f) => f,
            None => filter::LevelFilter::INFO,
        },
        Err(_) => filter::LevelFilter::INFO,
    };

    let (filter, reload_handle) = reload::Layer::new(filter);
    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::Layer::default())
        .init();
    LoggingHandle {
        handle: reload_handle,
    }
}

pub struct LoggingHandle {
    handle: Handle,
}

impl LoggingHandle {
    pub fn set_logging_level(&self, log_level: &str) -> bool {
        let level = match str_to_filter_level(log_level) {
            Some(l) => l,
            _ => {
                return false;
            }
        };
        let _ = self.handle.modify(|filter| *filter = level);
        true
    }
}
