use paste::paste;
use prometheus::{self, register_histogram, register_int_counter, Histogram, IntCounter};

#[macro_export]
macro_rules! process_provider_geter {
    ($_get: expr, $_provider_metrix: ident, $_metric: ident) => {
        paste! {
            match $_get {
                Ok(res) => {
                    $_provider_metrix.[<success_ $_metric>].inc();
                    res
                },
                Err(e) => {
                    $_provider_metrix.[<failed_ $_metric>].inc();
                    return Err(e.into());
                },
            }
        }
    };
}

#[derive(Debug)]
pub struct ProviderMetrics {
    pub total_tx_sent: IntCounter,
    pub gas_used: IntCounter,
    pub effective_gas_price: IntCounter,
    pub transaction_confirmation_times: Histogram,
    pub gas_price: Histogram,
    pub failed_send_tx: IntCounter,
    pub failed_get_receipt: IntCounter,
    pub failed_get_gas_price: IntCounter,
    pub failed_get_max_priority_fee_per_gas: IntCounter,
    pub failed_get_chain_id: IntCounter,
    pub success_send_tx: IntCounter,
    pub success_get_receipt: IntCounter,
    pub success_get_gas_price: IntCounter,
    pub success_get_max_priority_fee_per_gas: IntCounter,
    pub success_get_chain_id: IntCounter,
}

impl ProviderMetrics {
    pub fn new(net: &String) -> ProviderMetrics {
        ProviderMetrics {
            total_tx_sent: register_int_counter!(
                format!("{}_total_tx_sent", net),
                format!("Total number of tx sent for network {}", net)
            )
            .unwrap(),
            gas_used: register_int_counter!(
                format!("{}_gas_used", net),
                format!("Total amount of gas spend for network {}", net)
            )
            .unwrap(),
            effective_gas_price: register_int_counter!(
                format!("{}_effective_gas_price", net),
                format!("Total amount of Wei spend for network {}", net)
            )
            .unwrap(),
            transaction_confirmation_times: register_histogram!(
                format!("{}_transaction_confirmation_times", net),
                format!(
                    "Histogram tracking the time it took for update transaction to be confirmed {}",
                    net
                ),
                (1..).take(40).map(|x| x as f64 * 15000.0).collect()
            )
            .unwrap(),
            gas_price: register_histogram!(
                format!("{}_gas_price", net),
                format!(
                    "Histogram tracking the gas price in Gwei reported by the provider {}",
                    net
                ),
                (1..).take(40).map(|x| x as f64).collect()
            )
            .unwrap(),
            failed_send_tx: register_int_counter!(
                format!("{}_failed_send_tx", net),
                format!("Total number of failed tx for network {}", net)
            )
            .unwrap(),
            failed_get_receipt: register_int_counter!(
                format!("{}_failed_get_receipt", net),
                format!(
                    "Total number of failed get_receipt req-s for network {}",
                    net
                )
            )
            .unwrap(),
            failed_get_gas_price: register_int_counter!(
                format!("{}_failed_get_gas_price", net),
                format!(
                    "Total number of failed get_gas_price req-s for network {}",
                    net
                )
            )
            .unwrap(),
            failed_get_max_priority_fee_per_gas: register_int_counter!(
                format!("{}_failed_get_max_priority_fee_per_gas", net),
                format!(
                    "Total number of failed get_max_priority_fee_per_gas req-s for network {}",
                    net
                )
            )
            .unwrap(),
            failed_get_chain_id: register_int_counter!(
                format!("{}_failed_get_chain_id", net),
                format!(
                    "Total number of failed get_chain_id req-s for network {}",
                    net
                )
            )
            .unwrap(),
            success_send_tx: register_int_counter!(
                format!("{}_success_send_tx", net),
                format!("Total number of successful tx for network {}", net)
            )
            .unwrap(),
            success_get_receipt: register_int_counter!(
                format!("{}_success_get_receipt", net),
                format!(
                    "Total number of successful get_receipt req-s for network {}",
                    net
                )
            )
            .unwrap(),
            success_get_gas_price: register_int_counter!(
                format!("{}_success_get_gas_price", net),
                format!(
                    "Total number of successful get_gas_price req-s for network {}",
                    net
                )
            )
            .unwrap(),
            success_get_max_priority_fee_per_gas: register_int_counter!(
                format!("{}_success_get_max_priority_fee_per_gas", net),
                format!(
                    "Total number of successful get_max_priority_fee_per_gas req-s for network {}",
                    net
                )
            )
            .unwrap(),
            success_get_chain_id: register_int_counter!(
                format!("{}_success_get_chain_id", net),
                format!(
                    "Total number of successful get_chain_id req-s for network {}",
                    net
                )
            )
            .unwrap(),
        }
    }
}
