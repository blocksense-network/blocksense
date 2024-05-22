use std::sync::Arc;
use std::sync::Mutex;
use tracing_subscriber::filter::LevelFilter;
use tracing_subscriber::{filter, fmt, prelude::*, reload, Registry};

type Hanlde = tracing_subscriber::reload::Handle<LevelFilter, Registry>;
pub type SharedLoggingHandle = Arc<Mutex<LoggingHandle>>;

pub fn get_shared_logging_handle() -> Arc<Mutex<LoggingHandle>> {
    Arc::new(Mutex::new(get_logging_handle()))
}

pub fn get_logging_handle() -> LoggingHandle {
    let filter = filter::LevelFilter::DEBUG;
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
    handle: Hanlde,
}

impl LoggingHandle {
    pub fn set_logging_level(&self, log_level: &str) -> bool {
        let level = match log_level {
            "TRACE" => filter::LevelFilter::TRACE,
            "DEBUG" => filter::LevelFilter::DEBUG,
            "INFO" => filter::LevelFilter::INFO,
            "WARN" => filter::LevelFilter::WARN,
            "ERROR" => filter::LevelFilter::ERROR,
            _ => {
                return false;
            }
        };
        let _ = self.handle.modify(|filter| *filter = level);
        true
    }
}
