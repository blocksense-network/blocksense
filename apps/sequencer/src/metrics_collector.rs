use actix_web::rt::time;
use blocksense_metrics::metrics_collector::gather_and_dump_metrics;
use std::io::Error;
use tokio::time::Duration;

use tracing::{error, info, trace};

pub async fn metrics_collector_loop() -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("metrics_collector")
        .spawn_local(async move {
            info!("Starting metrics collector loop...");
            let mut interval = time::interval(Duration::from_millis(60000));
            loop {
                match gather_and_dump_metrics() {
                    Ok(output) => trace!("Dumping metrics for fun and profit: {}", output),
                    Err(e) => {
                        error!("Error getting metrics: {}", e.to_string());
                    }
                };
                interval.tick().await;
            }
        })
        .expect("Failed to spawn metrics collector loop!")
}
