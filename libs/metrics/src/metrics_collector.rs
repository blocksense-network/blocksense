use prometheus::Encoder;
use prometheus::TextEncoder;

use anyhow::Result;

use crate::metrics::BUILD_INFO;

pub fn gather_and_dump_metrics() -> Result<String> {
    let mut buffer = Vec::new();
    let encoder = TextEncoder::new();
    // Workaround for lack of strings in Prometheus.
    // Actual strings are set internally as labels by the BUILD_INFO gauge.
    BUILD_INFO.set(1);
    // Gather the metrics.
    let metric_families = prometheus::gather();
    // Encode them to send.
    if let Err(e) = encoder.encode(&metric_families, &mut buffer) {
        return Err(anyhow::anyhow!("{}", e.to_string()));
    }

    let output = match String::from_utf8(buffer) {
        Ok(result) => result,
        Err(e) => {
            return Err(anyhow::anyhow!("{}", e.to_string()));
        }
    };

    Ok(output)
}
