use prometheus::{
    self, register_histogram, register_int_counter, register_int_counter_vec, Histogram,
    IntCounter, IntCounterVec,
};

#[derive(Debug)]
pub struct ReporterMetrics {
    pub unrecognized_result_format: IntCounter,
    pub json_scheme_error: IntCounter,
    pub non_valid_feed_id_reports: IntCounter,
    pub timely_reports_per_feed: IntCounterVec,
    pub late_reports_per_feed: IntCounterVec,
    pub in_future_reports_per_feed: IntCounterVec,
    pub total_revotes_for_same_slot_per_feed: IntCounterVec,
}

impl ReporterMetrics {
    pub fn new(id: u64) -> ReporterMetrics {
        ReporterMetrics {
            unrecognized_result_format: register_int_counter!(
                format!("reporter_{}_unrecognized_result_format", id),
                format!(
                    "Total received votes with wrong result format from reporter id {}",
                    id
                )
            )
            .unwrap(),
            json_scheme_error: register_int_counter!(
                format!("reporter_{}_json_scheme_error", id),
                format!(
                    "Total times the recvd json did not match expected scheme from reporter id {}",
                    id
                ),
            )
            .unwrap(),
            non_valid_feed_id_reports: register_int_counter!(
                format!("reporter_{}_non_valid_feed_id_reports", id),
                format!(
                    "Total recvd reports for a non registered feed from reporter id {}",
                    id
                ),
            )
            .unwrap(),
            timely_reports_per_feed: register_int_counter_vec!(
                format!("reporter_{}_timely_reports_per_feed", id),
                format!(
                    "Per feed accepted (valid) feed reports from reporter id {}",
                    id
                ),
                &["FeedId"]
            )
            .unwrap(),
            late_reports_per_feed: register_int_counter_vec!(
                format!("reporter_{}_late_reporte_per_feed", id),
                format!(
                    "Per feed recvd reports for a past slot from reporter id {}",
                    id
                ),
                &["FeedId"]
            )
            .unwrap(),
            in_future_reports_per_feed: register_int_counter_vec!(
                format!("reporter_{}_in_future_reports_per_feed", id),
                format!(
                    "Per feed recvd reports for a future slot from reporter id {}",
                    id
                ),
                &["FeedId"]
            )
            .unwrap(),
            total_revotes_for_same_slot_per_feed: register_int_counter_vec!(
                format!("reporter_{}_total_revotes_for_same_slot_per_feed", id),
                format!(
                    "Total recvd revotes for the same slot from reporter id {}",
                    id
                ),
                &["FeedId"]
            )
            .unwrap(),
        }
    }
}
