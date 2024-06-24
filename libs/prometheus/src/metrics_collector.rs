use prometheus_framework::Encoder;
use prometheus_framework::TextEncoder;

use anyhow::Result;

pub fn gather_and_dump_metrics() -> Result<String> {
    let mut buffer = Vec::new();
    let encoder = TextEncoder::new();

    // Gather the metrics.
    let metric_families = prometheus_framework::gather();
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
