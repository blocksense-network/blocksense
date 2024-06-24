use prometheus_framework::{
    register_counter, register_histogram, register_int_counter, register_int_counter_vec,
    register_int_gauge, register_int_gauge_vec, Counter, Histogram, IntCounter, IntCounterVec,
    IntGauge, IntGaugeVec,
};

use anyhow::Result;

lazy_static::lazy_static! {
    pub static ref DATA_FEED_PARSE_TIME_GAUGE: IntGaugeVec = register_int_gauge_vec!("DATA_FEED_PARSE_TIME_GAUGE", "Time(ms) to parse current feed",&["Feed"]).unwrap();
}

lazy_static::lazy_static! {
    pub static ref BATCH_COUNTER: IntCounter =
        register_int_counter!("BATCH_COUNTER", "number of batches served").unwrap();

        pub static ref BATCH_SIZE: IntCounter =
        register_int_counter!("FEED_COUNTER", "Available feed count").unwrap();

        pub static ref FEED_COUNTER: IntCounter =
        register_int_counter!("FEED_COUNTER", "Available feed count").unwrap();

        pub  static ref UPTIME_COUNTER: Counter =
        register_counter!("UPTIME_COUNTER", "Runtime(sec) duration of reporter").unwrap();

        pub static ref BATCH_PARSE_TIME_GAUGE: IntGauge = register_int_gauge!("BATCH_PARSE_TIME_GAUGE", "Time(ms) to parse current batch").unwrap();
}

#[macro_export]
macro_rules! process_provider_getter {
    ($_get: expr, $_provider_metrics: ident, $_metric: ident) => {
        paste! {
            match $_get {
                Ok(res) => {
                    $_provider_metrics.[<success_ $_metric>].inc();
                    res
                },
                Err(e) => {
                    $_provider_metrics.[<failed_ $_metric>].inc();
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
    pub total_timed_out_tx: IntCounter,
}

impl ProviderMetrics {
    pub fn new(net: &String) -> Result<ProviderMetrics> {
        Ok(ProviderMetrics {
            total_tx_sent: register_int_counter!(
                format!("{}_total_tx_sent", net),
                format!("Total number of tx sent for network {}", net)
            )?,
            gas_used: register_int_counter!(
                format!("{}_gas_used", net),
                format!("Total amount of gas spend for network {}", net)
            )?,
            effective_gas_price: register_int_counter!(
                format!("{}_effective_gas_price", net),
                format!("Total amount of Wei spend for network {}", net)
            )?,
            transaction_confirmation_times: register_histogram!(
                format!("{}_transaction_confirmation_times", net),
                format!(
                    "Histogram tracking the time it took for update transaction to be confirmed {}",
                    net
                ),
                (1..).take(40).map(|x| x as f64 * 15000.0).collect()
            )?,
            gas_price: register_histogram!(
                format!("{}_gas_price", net),
                format!(
                    "Histogram tracking the gas price in Gwei reported by the provider {}",
                    net
                ),
                (1..).take(40).map(|x| x as f64).collect()
            )?,
            failed_send_tx: register_int_counter!(
                format!("{}_failed_send_tx", net),
                format!("Total number of failed tx for network {}", net)
            )?,
            failed_get_receipt: register_int_counter!(
                format!("{}_failed_get_receipt", net),
                format!(
                    "Total number of failed get_receipt req-s for network {}",
                    net
                )
            )?,
            failed_get_gas_price: register_int_counter!(
                format!("{}_failed_get_gas_price", net),
                format!(
                    "Total number of failed get_gas_price req-s for network {}",
                    net
                )
            )?,
            failed_get_max_priority_fee_per_gas: register_int_counter!(
                format!("{}_failed_get_max_priority_fee_per_gas", net),
                format!(
                    "Total number of failed get_max_priority_fee_per_gas req-s for network {}",
                    net
                )
            )?,
            failed_get_chain_id: register_int_counter!(
                format!("{}_failed_get_chain_id", net),
                format!(
                    "Total number of failed get_chain_id req-s for network {}",
                    net
                )
            )?,
            success_send_tx: register_int_counter!(
                format!("{}_success_send_tx", net),
                format!("Total number of successful tx for network {}", net)
            )?,
            success_get_receipt: register_int_counter!(
                format!("{}_success_get_receipt", net),
                format!(
                    "Total number of successful get_receipt req-s for network {}",
                    net
                )
            )?,
            success_get_gas_price: register_int_counter!(
                format!("{}_success_get_gas_price", net),
                format!(
                    "Total number of successful get_gas_price req-s for network {}",
                    net
                )
            )?,
            success_get_max_priority_fee_per_gas: register_int_counter!(
                format!("{}_success_get_max_priority_fee_per_gas", net),
                format!(
                    "Total number of successful get_max_priority_fee_per_gas req-s for network {}",
                    net
                )
            )?,
            success_get_chain_id: register_int_counter!(
                format!("{}_success_get_chain_id", net),
                format!(
                    "Total number of successful get_chain_id req-s for network {}",
                    net
                )
            )?,
            total_timed_out_tx: register_int_counter!(
                format!("{}_total_timed_out_tx", net),
                format!("Total number of tx sent that reached the configured timeout before completion for network {}", net)
            )?,
        })
    }
}

#[macro_export]
macro_rules! inc_reporter_metric (
    ($_reporter: ident, $_metric: ident) => (
        $_reporter
        .read() // Holding a read lock here suffice, since the counters are atomic.
        .unwrap()
        .reporter_metrics
        .$_metric
        .inc();
    );
);

#[macro_export]
macro_rules! inc_reporter_vec_metric (
    ($_reporter: ident, $_metric: ident, $_index: ident) => (
        $_reporter
        .read() // Holding a read lock here suffice, since the counters are atomic.
        .unwrap()
        .reporter_metrics
        .$_metric
        .with_label_values(&[&$_index.to_string()])
        .inc();
    );
);

#[derive(Debug)]
pub struct ReporterMetrics {
    pub errors_reported_for_feed: IntCounter,
    pub json_scheme_error: IntCounter,
    pub non_valid_feed_id_reports: IntCounter,
    pub non_valid_signature: IntCounter,
    pub timely_reports_per_feed: IntCounterVec,
    pub late_reports_per_feed: IntCounterVec,
    pub in_future_reports_per_feed: IntCounterVec,
    pub total_revotes_for_same_slot_per_feed: IntCounterVec,
}

impl ReporterMetrics {
    pub fn new(id: u64) -> Result<ReporterMetrics> {
        Ok(ReporterMetrics {
            errors_reported_for_feed: register_int_counter!(
                format!("reporter_{}_errors_reported_for_feed", id),
                format!(
                    "Total received votes indicating error from reporter id {}",
                    id
                )
            )?,
            json_scheme_error: register_int_counter!(
                format!("reporter_{}_json_scheme_error", id),
                format!(
                    "Total times the recvd json did not match expected scheme from reporter id {}",
                    id
                ),
            )?,
            non_valid_feed_id_reports: register_int_counter!(
                format!("reporter_{}_non_valid_feed_id_reports", id),
                format!(
                    "Total recvd reports for a non registered feed from reporter id {}",
                    id
                ),
            )?,
            non_valid_signature: register_int_counter!(
                format!("reporter_{}_non_valid_signature", id),
                format!(
                    "Total recvd reports with non valid signature from reporter id {}",
                    id
                ),
            )?,
            timely_reports_per_feed: register_int_counter_vec!(
                format!("reporter_{}_timely_reports_per_feed", id),
                format!(
                    "Per feed accepted (valid) feed reports from reporter id {}",
                    id
                ),
                &["FeedId"]
            )?,
            late_reports_per_feed: register_int_counter_vec!(
                format!("reporter_{}_late_reporte_per_feed", id),
                format!(
                    "Per feed recvd reports for a past slot from reporter id {}",
                    id
                ),
                &["FeedId"]
            )?,
            in_future_reports_per_feed: register_int_counter_vec!(
                format!("reporter_{}_in_future_reports_per_feed", id),
                format!(
                    "Per feed recvd reports for a future slot from reporter id {}",
                    id
                ),
                &["FeedId"]
            )?,
            total_revotes_for_same_slot_per_feed: register_int_counter_vec!(
                format!("reporter_{}_total_revotes_for_same_slot_per_feed", id),
                format!(
                    "Total recvd revotes for the same slot from reporter id {}",
                    id
                ),
                &["FeedId"]
            )?,
        })
    }
}
