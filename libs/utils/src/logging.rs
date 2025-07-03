use std::sync::Arc;
use std::sync::Mutex;
use std::{env, io::IsTerminal};
use tracing_subscriber::filter::LevelFilter;
use tracing_subscriber::prelude::*;
use tracing_subscriber::{filter, fmt, reload, Registry};

type Handle = tracing_subscriber::reload::Handle<LevelFilter, Registry>;
pub type SharedLoggingHandle = Arc<Mutex<LoggingHandle>>;

pub struct LoggingHandle {
    pub handle: Handle,
}

impl LoggingHandle {
    pub fn set_logging_level(&self, log_level: &str) -> bool {
        let level = match str_to_filter_level(log_level) {
            Some(l) => l,
            _ => return false,
        };
        let _ = self.handle.modify(|filter| *filter = level);
        true
    }
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

use std::sync::OnceLock;

fn shared_logging_handle_get_or_init(
    level: &str,
    tokio_console: bool,
) -> &'static SharedLoggingHandle {
    static SHARED_LOGGING_HANDLE: OnceLock<SharedLoggingHandle> = OnceLock::new();
    SHARED_LOGGING_HANDLE
        .get_or_init(move || Arc::new(Mutex::new(init_logging_handle(level, tokio_console))))
}

pub fn init_shared_logging_handle(level: &str, tokio_console: bool) -> SharedLoggingHandle {
    shared_logging_handle_get_or_init(level, tokio_console).clone()
}

pub fn get_shared_logging_handle() -> SharedLoggingHandle {
    shared_logging_handle_get_or_init("INFO", true).clone() // The parameters won't matter if init was previously called.
}

pub fn tokio_console_active(app_name: &str, default_val: bool) -> bool {
    match env::var(app_name.to_string() + "_TOKIO_CONSOLE") {
        Ok(val) => val == "true",
        Err(_) => default_val,
    }
}

pub fn get_log_level(app_name: &str) -> String {
    match env::var(app_name.to_string() + "_LOG_LEVEL") {
        Ok(logging_level) => logging_level,
        Err(_) => "INFO".to_string(),
    }
}

pub fn init_logging_handle(logging_level: &str, tokio_console: bool) -> LoggingHandle {
    let filter = match str_to_filter_level(logging_level) {
        Some(f) => f,
        None => filter::LevelFilter::INFO,
    };

    let (layer_filter, reload_handle) = reload::Layer::new(filter);

    if tokio_console {
        // spawn the console server in the background,
        // returning a `Layer`:
        let console_layer = console_subscriber::spawn();

        // build a `Subscriber` by combining layers with a
        // `tracing_subscriber::Registry`:
        tracing_subscriber::registry()
            // add the console layer to the subscriber
            .with(console_layer)
            // add the logs layer
            .with(
                tracing_subscriber::fmt::layer()
                    .with_ansi(std::io::stderr().is_terminal())
                    .with_filter(filter),
            )
            .init();
    } else {
        tracing_subscriber::registry()
            .with(layer_filter)
            .with(fmt::Layer::default().with_ansi(std::io::stderr().is_terminal()))
            .init();
    }
    LoggingHandle {
        handle: reload_handle,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_set_logging_levels() {
        // Test env variable sets up the logging level
        let shared_logging_handle = init_shared_logging_handle("TRACE", false);
        let logging_handle = shared_logging_handle.lock().unwrap();

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
