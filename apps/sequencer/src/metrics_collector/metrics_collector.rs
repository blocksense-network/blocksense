use actix_web::rt::spawn;
use actix_web::rt::time;
use prometheus::metrics_collector::gather_and_dump_metrics;
use std::io::Error;
use tokio::time::Duration;

use tracing::{debug, error};

pub async fn metrics_collector_loop() -> tokio::task::JoinHandle<Result<(), Error>> {
    spawn(async move {
        let mut interval = time::interval(Duration::from_millis(60000));
        loop {
            match gather_and_dump_metrics() {
                Ok(output) => debug!("{}", output),
                Err(e) => {
                    error!("Error getting metrics: {}", e.to_string());
                }
            };
            interval.tick().await;
        }
    })
}
