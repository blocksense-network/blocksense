use prometheus_framework::{
    labels, opts, register_counter, register_histogram_vec, register_int_counter,
    register_int_counter_vec, register_int_gauge, register_int_gauge_vec, Counter, HistogramVec,
    IntCounter, IntCounterVec, IntGauge, IntGaugeVec,
};

use utils::build_info::{
    BLOCKSENSE_VERSION, GIT_BRANCH, GIT_DIRTY, GIT_HASH, GIT_HASH_SHORT, GIT_TAG,
    VERGEN_CARGO_DEBUG, VERGEN_CARGO_FEATURES, VERGEN_CARGO_OPT_LEVEL, VERGEN_RUSTC_SEMVER,
};

use anyhow::Result;

lazy_static::lazy_static! {
    pub static ref DATA_FEED_PARSE_TIME_GAUGE: IntGaugeVec = register_int_gauge_vec!("DATA_FEED_PARSE_TIME_GAUGE", "Time(ms) to parse current feed",&["Feed"]).unwrap();
}

lazy_static::lazy_static! {
    pub static ref BATCH_COUNTER: IntCounter =
        register_int_counter!("BATCH_COUNTER", "number of batches served").unwrap();

        pub static ref BATCH_SIZE: IntCounter =
        register_int_counter!("BATCH_SIZE", "batch size").unwrap();

        pub static ref FEED_COUNTER: IntCounter =
        register_int_counter!("FEED_COUNTER", "Available feed count").unwrap();

        pub  static ref UPTIME_COUNTER: Counter =
        register_counter!("UPTIME_COUNTER", "Runtime(sec) duration of reporter").unwrap();

        pub static ref BATCH_PARSE_TIME_GAUGE: IntGauge = register_int_gauge!("BATCH_PARSE_TIME_GAUGE", "Time(ms) to parse current batch").unwrap();

        pub static ref BUILD_INFO: IntGauge = register_int_gauge!(opts!(
            "BUILD_INFO",
            "BUILD info to identify version of this software product",
            labels! {
                "version" => BLOCKSENSE_VERSION,
                "git_hash" => GIT_HASH,
                "git_hash_short" => GIT_HASH_SHORT,
                "git_dirty" => GIT_DIRTY,
                "git_branch" => GIT_BRANCH,
                "git_tag" => GIT_TAG,
                "debug" => VERGEN_CARGO_DEBUG,
                "features" => VERGEN_CARGO_FEATURES,
                "optimizations" => VERGEN_CARGO_OPT_LEVEL,
                "compiler" => VERGEN_RUSTC_SEMVER,
            }
        )).unwrap();
}

lazy_static::lazy_static! {
pub static ref REPORTER_FEED_COUNTER: IntCounter =
    register_int_counter!("FEED_COUNTER", "Available feed count").unwrap();

pub static ref REPORTER_BATCH_COUNTER: IntCounter =
    register_int_counter!("BATCH_COUNTER", "number of batches served").unwrap();

pub static ref REPORTER_FAILED_WASM_EXECS: IntCounterVec =
    register_int_counter_vec!("FAILED_WASM_EXECS",
        "Count of failed wasm executions", &["oracle_id"]).unwrap();

pub static ref REPORTER_FAILED_SEQ_REQUESTS: IntCounterVec =
    register_int_counter_vec!("FAILED_SEQ_REQUESTS",
        "Count of failed sequncer requests", &["code"]).unwrap();

pub static ref REPORTER_WASM_EXECUTION_TIME_GAUGE: IntGaugeVec =
    register_int_gauge_vec!("WASM_EXECUTION_TIME_GAUGE",
        "Time(ms) to execute current wasm component", &["oracle_id"]).unwrap();

}

#[macro_export]
macro_rules! process_provider_getter {
    ($_get: expr, $_net: ident, $_provider_metrics: ident, $_metric: ident) => {
        paste! {
            match $_get {
                Ok(res) => {
                    $_provider_metrics.read() // Holding a read lock here suffice, since the counters are atomic.
                    .await
                    .[<success_ $_metric>]
                    .with_label_values(&[&$_net.to_string()])
                    .inc();
                    res
                },
                Err(e) => {
                    $_provider_metrics.read() // Holding a read lock here suffice, since the counters are atomic.
                    .await
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
    .await
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
    .await
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
    .await
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
    pub total_signed_aggregates_revcd: IntCounterVec,
    pub total_corrupt_aggregates_signatures_recvd: IntCounterVec,
    pub total_non_expected_signed_aggregates_revcd: IntCounterVec,
    pub total_corrupt_aggregates_tx_data_recvd: IntCounterVec,
    pub total_signed_aggregates_with_incorrect_signatures_revcd: IntCounterVec,
    pub total_aggregate_quorums_reached: IntCounterVec,
}

impl ProviderMetrics {
    pub fn new(prefix: &str) -> Result<ProviderMetrics> {
        Ok(ProviderMetrics {
        total_tx_sent: register_int_counter_vec!(
            format!("{}total_tx_sent", prefix),
            "Total number of tx sent",
            &["Network"]
        )?,
        gas_used: register_int_counter_vec!(
            format!("{}gas_used", prefix),
            "Total amount of gas spend for network",
            &["Network"]
        )?,
        effective_gas_price: register_int_counter_vec!(
            format!("{}effective_gas_price", prefix),
            "Total amount of Wei spend for network",
            &["Network"]
        )?,
        transaction_confirmation_times: register_histogram_vec!(
            format!("{}transaction_confirmation_times", prefix),
            "Histogram tracking the time it took for update transaction to be confirmed",
            &["Network"],
            (1..).take(40).map(|x| x as f64 * 15000.0).collect(),
        )?,
        gas_price: register_histogram_vec!(
            format!("{}gas_price", prefix),
            "Histogram tracking the gas price in Gwei reported by the provider",
            &["Network"],
            (1..).take(40).map(|x| x as f64).collect(),
        )?,
        failed_send_tx: register_int_counter_vec!(
            format!("{}failed_send_tx", prefix),
            "Total number of failed tx for network",
            &["Network"]
        )?,
        failed_get_receipt: register_int_counter_vec!(
            format!("{}failed_get_receipt", prefix),
            "Total number of failed get_receipt req-s for network",
            &["Network"]
        )?,
        failed_get_gas_price: register_int_counter_vec!(
            format!("{}failed_get_gas_price", prefix),
                "Total number of failed get_gas_price req-s for network",
                &["Network"]
            )?,
            failed_get_max_priority_fee_per_gas: register_int_counter_vec!(
                format!("{}failed_get_max_priority_fee_per_gas", prefix),
                "Total number of failed get_max_priority_fee_per_gas req-s for network",
                &["Network"]
            )?,
            failed_get_chain_id: register_int_counter_vec!(
                format!("{}failed_get_chain_id", prefix),
                "Total number of failed get_chain_id req-s for network",
                &["Network"]
            )?,
            success_send_tx: register_int_counter_vec!(
                format!("{}success_send_tx", prefix),
                "Total number of successful tx for network",
                &["Network"]
            )?,
            success_get_receipt: register_int_counter_vec!(
                format!("{}success_get_receipt", prefix),
                "Total number of successful get_receipt req-s for network",
                &["Network"]
            )?,
            success_get_gas_price: register_int_counter_vec!(
                format!("{}success_get_gas_price", prefix),
                "Total number of successful get_gas_price req-s for network",
                &["Network"]
            )?,
            success_get_max_priority_fee_per_gas: register_int_counter_vec!(
                format!("{}success_get_max_priority_fee_per_gas", prefix),
               "Total number of successful get_max_priority_fee_per_gas req-s for network",
                &["Network"]
            )?,
            success_get_chain_id: register_int_counter_vec!(
                format!("{}success_get_chain_id", prefix),
                "Total number of successful get_chain_id req-s for network",
                &["Network"]
            )?,
            total_timed_out_tx: register_int_counter_vec!(
                format!("{}total_timed_out_tx", prefix),
                "Total number of tx sent that reached the configured timeout before completion for network",
                &["Network"]
            )?,
            total_signed_aggregates_revcd: register_int_counter_vec!(
                format!("{}total_signed_aggregates_revcd", prefix),
                "Total number of second round consensus votes received for a given network by a given reporter",
                &["Network", "ReporterId"]
            )?,
            total_corrupt_aggregates_signatures_recvd: register_int_counter_vec!(
                format!("{}total_corrupt_aggregates_signatures_recvd", prefix),
                "Total number of second round consensus votes with corrupt signatures received for a given network by a given reporter",
                &["Network", "ReporterId"]
            )?,
            total_non_expected_signed_aggregates_revcd: register_int_counter_vec!(
                format!("{}total_non_expected_signed_aggregates_revcd", prefix),
                "Total number of non expected second round consensus votes received for a given network by a given reporter",
                &["Network", "ReporterId"]
            )?,
            total_corrupt_aggregates_tx_data_recvd: register_int_counter_vec!(
                format!("{}total_corrupt_aggregates_tx_data_recvd", prefix),
                "Total number of second round consensus votes with corrupt tx_data received for a given network by a given reporter",
                &["Network", "ReporterId"]
            )?,
            total_signed_aggregates_with_incorrect_signatures_revcd: register_int_counter_vec!(
                format!("{}total_signed_aggregates_with_incorrect_signatures_revcd", prefix),
                "Total number of second round consensus votes with non valid signature received for a given network by a given reporter",
                &["Network", "ReporterId"]
            )?,
            total_aggregate_quorums_reached: register_int_counter_vec!(
                format!("{}total_aggregate_quorums_reached", prefix),
                "Total number of second round consensus quorums reached for a given network",
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
    pub fn new(prefix: &str) -> Result<ReporterMetrics> {
        Ok(ReporterMetrics {
            errors_reported_for_feed: register_int_counter_vec!(
                format!("{}reporter_errors_reported_for_feed", prefix),
                "Total received votes indicating error from reporter",
                &["ReporterId"]
            )?,
            json_scheme_error: register_int_counter_vec!(
                format!("{}reporter_json_scheme_error", prefix),
                "Total times the recvd json did not match expected scheme from reporter",
                &["ReporterId"]
            )?,
            non_valid_feed_id_reports: register_int_counter_vec!(
                format!("{}reporter_non_valid_feed_id_reports", prefix),
                "Total recvd reports for a non registered feed from reporter",
                &["ReporterId"]
            )?,
            non_valid_signature: register_int_counter_vec!(
                format!("{}reporter_non_valid_signature", prefix),
                "Total recvd reports with non valid signature from reporter",
                &["ReporterId"]
            )?,
            timely_reports_per_feed: register_int_counter_vec!(
                format!("{}reporter_timely_reports_per_feed", prefix),
                "Per feed accepted (valid) feed reports from reporter",
                &["ReporterId", "FeedId"]
            )?,
            late_reports_per_feed: register_int_counter_vec!(
                format!("{}reporter_late_reporte_per_feed", prefix),
                "Per feed recvd reports for a past slot from reporter",
                &["ReporterId", "FeedId"]
            )?,
            in_future_reports_per_feed: register_int_counter_vec!(
                format!("{}reporter_in_future_reports_per_feed", prefix),
                "Per feed recvd reports for a future slot from reporter",
                &["ReporterId", "FeedId"]
            )?,
            total_revotes_for_same_slot_per_feed: register_int_counter_vec!(
                format!("{}reporter_total_revotes_for_same_slot_per_feed", prefix),
                "Total recvd revotes for the same slot from reporter",
                &["ReporterId", "FeedId"]
            )?,
        })
    }
}

#[derive(Debug)]
pub struct FeedsMetrics {
    pub quorums_reached: IntCounterVec,
    pub failures_to_reach_quorum: IntCounterVec,
    pub updates_to_networks: IntCounterVec,
}

impl FeedsMetrics {
    pub fn new(prefix: &str) -> Result<FeedsMetrics> {
        Ok(FeedsMetrics {
            quorums_reached: register_int_counter_vec!(
                format!("{}quorums_reached", prefix),
                "Number of slots for which quorum was reached for a given feed id",
                &["FeedId"]
            )?,
            failures_to_reach_quorum: register_int_counter_vec!(
                format!("{}failures_to_reach_quorum", prefix),
                "Number of slots for whcih quorum was not reached for a given feed id",
                &["FeedId"]
            )?,
            updates_to_networks: register_int_counter_vec!(
                format!("{}updates_to_networks", prefix),
                "Number of updates for a given feed id per Network",
                &["FeedId", "Network"]
            )?,
        })
    }
}
