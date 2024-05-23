use prometheus::{self, register_int_counter, IntCounter};

#[derive(Debug)]
pub struct ProviderMetrics {
    pub total_tx_sent: IntCounter,
}

impl ProviderMetrics {
    pub fn new(net: &String) -> ProviderMetrics {
        ProviderMetrics {
            total_tx_sent: register_int_counter!(
                format!("{}_total_tx_sent", net),
                format!("Total Number of tx sent for network {}", net)
            )
            .unwrap(),
        }
    }
}
