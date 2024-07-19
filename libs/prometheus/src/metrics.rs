use prometheus_framework::{
    register_counter, register_histogram_vec, register_int_counter, register_int_counter_vec,
    register_int_gauge, register_int_gauge_vec, Counter, HistogramVec, IntCounter, IntCounterVec,
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
    ($_get: expr, $_net: ident, $_provider_metrics: ident, $_metric: ident) => {
        paste! {
            match $_get {
                Ok(res) => {
                    $_provider_metrics.read() // Holding a read lock here suffice, since the counters are atomic.
                    .unwrap()
                    .[<success_ $_metric>]
                    .with_label_values(&[&$_net.to_string()])
                    .inc();
                    res
                },
                Err(e) => {
                    $_provider_metrics.read() // Holding a read lock here suffice, since the counters are atomic.
                    .unwrap()
                    .[<failed_ $_metric>]
                    .with_label_values(&[&$_net.to_string()])
                    .inc();
                    return Err(e.into());
                },
            }
        }
    };
}

#[macro_export]
macro_rules! inc_metric (
    ($_component: ident, $_comp_index: ident, $_metric: ident) => (
        $_component
        .read() // Holding a read lock here suffice, since the counters are atomic.
        .unwrap()
        .$_metric
        .with_label_values(&[&$_comp_index.to_string()])
        .inc();
    );
);

#[macro_export]
macro_rules! inc_metric_by (
    ($_component: ident, $_comp_index: ident, $_metric: ident, $_inc_val: ident) => (
        $_component
        .read() // Holding a read lock here suffice, since the counters are atomic.
        .unwrap()
        .$_metric
        .with_label_values(&[&$_comp_index.to_string()])
        .inc_by($_inc_val as u64);
    );
);

#[macro_export]
macro_rules! inc_vec_metric (
    ($_component: ident, $_comp_index: ident, $_metric: ident, $_index: ident) => (
        $_component
        .read() // Holding a read lock here suffice, since the counters are atomic.
        .unwrap()
        .$_metric
        .with_label_values(&[&$_comp_index.to_string(), &$_index.to_string()])
        .inc();
    );
);

#[derive(Debug)]
pub struct ProviderMetrics {
    pub total_tx_sent: IntCounterVec,
    pub gas_used: IntCounterVec,
    pub effective_gas_price: IntCounterVec,
    pub transaction_confirmation_times: HistogramVec,
    pub gas_price: HistogramVec,
    pub failed_send_tx: IntCounterVec,
    pub failed_get_receipt: IntCounterVec,
    pub failed_get_gas_price: IntCounterVec,
    pub failed_get_max_priority_fee_per_gas: IntCounterVec,
    pub failed_get_chain_id: IntCounterVec,
    pub success_send_tx: IntCounterVec,
    pub success_get_receipt: IntCounterVec,
    pub success_get_gas_price: IntCounterVec,
    pub success_get_max_priority_fee_per_gas: IntCounterVec,
    pub success_get_chain_id: IntCounterVec,
    pub total_timed_out_tx: IntCounterVec,
}

impl ProviderMetrics {
    pub fn new() -> Result<ProviderMetrics> {
        Ok(ProviderMetrics {
            total_tx_sent: register_int_counter_vec!(
                "total_tx_sent",
                "Total number of tx sent",
                &["Network"]
            )?,
            gas_used: register_int_counter_vec!(
                "gas_used",
                "Total amount of gas spend for network",
                &["Network"]
            )?,
            effective_gas_price: register_int_counter_vec!(
                "effective_gas_price",
                "Total amount of Wei spend for network",
                &["Network"]
            )?,
            transaction_confirmation_times: register_histogram_vec!(
                "transaction_confirmation_times",
                "Histogram tracking the time it took for update transaction to be confirmed",
                &["Network"],
                (1..).take(40).map(|x| x as f64 * 15000.0).collect(),
            )?,
            gas_price: register_histogram_vec!(
                "gas_price",

                    "Histogram tracking the gas price in Gwei reported by the provider"
                ,
                &["Network"],
                (1..).take(40).map(|x| x as f64).collect(),
            )?,
            failed_send_tx: register_int_counter_vec!(
                "failed_send_tx",
                "Total number of failed tx for network",
                &["Network"]
            )?,
            failed_get_receipt: register_int_counter_vec!(
                "failed_get_receipt",

                    "Total number of failed get_receipt req-s for network"
                ,
                &["Network"]
            )?,
            failed_get_gas_price: register_int_counter_vec!(
                "failed_get_gas_price",

                    "Total number of failed get_gas_price req-s for network"
                ,
                &["Network"]
            )?,
            failed_get_max_priority_fee_per_gas: register_int_counter_vec!(
                "failed_get_max_priority_fee_per_gas",

                    "Total number of failed get_max_priority_fee_per_gas req-s for network"
                ,
                &["Network"]
            )?,
            failed_get_chain_id: register_int_counter_vec!(
                "failed_get_chain_id",

                    "Total number of failed get_chain_id req-s for network"
                ,
                &["Network"]
            )?,
            success_send_tx: register_int_counter_vec!(
                "success_send_tx",
                "Total number of successful tx for network",
                &["Network"]
            )?,
            success_get_receipt: register_int_counter_vec!(
                "success_get_receipt",

                    "Total number of successful get_receipt req-s for network"
                ,
                &["Network"]
            )?,
            success_get_gas_price: register_int_counter_vec!(
                "success_get_gas_price",

                    "Total number of successful get_gas_price req-s for network"
                ,
                &["Network"]
            )?,
            success_get_max_priority_fee_per_gas: register_int_counter_vec!(
                "success_get_max_priority_fee_per_gas",

                    "Total number of successful get_max_priority_fee_per_gas req-s for network",

                &["Network"]
            )?,
            success_get_chain_id: register_int_counter_vec!(
                "success_get_chain_id",

                    "Total number of successful get_chain_id req-s for network"
                ,
                &["Network"]
            )?,
            total_timed_out_tx: register_int_counter_vec!(
                "total_timed_out_tx",
                "Total number of tx sent that reached the configured timeout before completion for network",
                &["Network"]
            )?,
        })
    }
}

#[derive(Debug)]
pub struct ReporterMetrics {
    pub errors_reported_for_feed: IntCounterVec,
    pub json_scheme_error: IntCounterVec,
    pub non_valid_feed_id_reports: IntCounterVec,
    pub non_valid_signature: IntCounterVec,
    pub timely_reports_per_feed: IntCounterVec,
    pub late_reports_per_feed: IntCounterVec,
    pub in_future_reports_per_feed: IntCounterVec,
    pub total_revotes_for_same_slot_per_feed: IntCounterVec,
}

impl ReporterMetrics {
    pub fn new() -> Result<ReporterMetrics> {
        Ok(ReporterMetrics {
            errors_reported_for_feed: register_int_counter_vec!(
                "reporter_errors_reported_for_feed",
                "Total received votes indicating error from reporter",
                &["ReporterId"]
            )?,
            json_scheme_error: register_int_counter_vec!(
                "reporter_json_scheme_error",
                "Total times the recvd json did not match expected scheme from reporter",
                &["ReporterId"]
            )?,
            non_valid_feed_id_reports: register_int_counter_vec!(
                "reporter_non_valid_feed_id_reports",
                "Total recvd reports for a non registered feed from reporter",
                &["ReporterId"]
            )?,
            non_valid_signature: register_int_counter_vec!(
                "reporter_non_valid_signature",
                "Total recvd reports with non valid signature from reporter",
                &["ReporterId"]
            )?,
            timely_reports_per_feed: register_int_counter_vec!(
                "reporter_timely_reports_per_feed",
                "Per feed accepted (valid) feed reports from reporter",
                &["ReporterId", "FeedId"]
            )?,
            late_reports_per_feed: register_int_counter_vec!(
                "reporter_late_reporte_per_feed",
                "Per feed recvd reports for a past slot from reporter",
                &["ReporterId", "FeedId"]
            )?,
            in_future_reports_per_feed: register_int_counter_vec!(
                "reporter_in_future_reports_per_feed",
                "Per feed recvd reports for a future slot from reporter",
                &["ReporterId", "FeedId"]
            )?,
            total_revotes_for_same_slot_per_feed: register_int_counter_vec!(
                "reporter_total_revotes_for_same_slot_per_feed",
                "Total recvd revotes for the same slot from reporter",
                &["ReporterId", "FeedId"]
            )?,
        })
    }
}
