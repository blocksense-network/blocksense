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
    pub handle: Handle,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_set_logging_levels() {
        // Test env variable sets up the logging level
        env::set_var("SEQUENCER_LOGGING_LEVEL", "TRACE");
        let logging_handle = init_logging_handle();
        logging_handle
            .handle
            .modify(|filter| assert_eq!(filter.to_string(), "trace"))
            .unwrap();

        // Test all logging levels are set up correctly
        let levels = ["DEBUG", "INFO", "WARN", "ERROR"];
        for level in levels {
            logging_handle.set_logging_level(level);
            logging_handle
                .handle
                .modify(|filter| assert_eq!(filter.to_string(), level.to_lowercase()))
                .unwrap();
        }

        // Test unknown logging level does not change the current one
        // Let's first set the logging level to something valid
        logging_handle.set_logging_level("ERROR");
        logging_handle
            .handle
            .modify(|filter| assert_eq!(filter.to_string(), "error"))
            .unwrap();

        // And then try to set it to unknown logging level
        logging_handle.set_logging_level("Unknown-Level");
        logging_handle
            .handle
            .modify(|filter| assert_eq!(filter.to_string(), "error"))
            .unwrap();
    }
}
