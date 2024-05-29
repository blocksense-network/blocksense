use actix_web::rt::spawn;
use actix_web::rt::time;
use prometheus::Encoder;
use prometheus::TextEncoder;
use tokio::time::Duration;

use tracing::info;

pub struct MetricsCollector {}

impl MetricsCollector {
    pub fn new() -> MetricsCollector {
        spawn(async move {
            let mut interval = time::interval(Duration::from_millis(60000));
            interval.tick().await;
            loop {
                let mut buffer = Vec::new();
                let encoder = TextEncoder::new();

                // Gather the metrics.
                let metric_families = prometheus::gather();
                // Encode them to send.
                encoder.encode(&metric_families, &mut buffer).unwrap();

                let output = String::from_utf8(buffer.clone()).unwrap();
                info!("Prometheus metrics:\n{}", output);

                interval.tick().await;
            }
        });
        MetricsCollector {}
    }
}
