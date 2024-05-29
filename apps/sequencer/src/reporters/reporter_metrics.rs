use prometheus::{self, register_histogram, register_int_counter, Histogram, IntCounter};

#[derive(Debug)]
pub struct ReporterMetrics {
    pub unrecognized_result_format: IntCounter,
    pub json_scheme_error: IntCounter,
    pub late_reports: IntCounter,
    pub reports_in_future: IntCounter,
    pub non_valid_feed_id_reports: IntCounter,
    pub total_accepted_feed_votes: IntCounter,
    pub total_revotes_for_same_slot: IntCounter,
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
            late_reports: register_int_counter!(
                format!("reporter_{}_num_late_reports", id),
                format!(
                    "Total recvd reports for a past slot from reporter id {}",
                    id
                ),
            )
            .unwrap(),
            reports_in_future: register_int_counter!(
                format!("reporter_{}_num_reports_in_future", id),
                format!(
                    "Total recvd reports for a future slot from reporter id {}",
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
            total_accepted_feed_votes: register_int_counter!(
                format!("reporter_{}_total_accepted_feed_votes", id),
                format!(
                    "Total accepted (valid) feed reports from reporter id {}",
                    id
                ),
            )
            .unwrap(),
            total_revotes_for_same_slot: register_int_counter!(
                format!("reporter_{}_total_revotes_for_same_slot", id),
                format!(
                    "Total recvd votes for the same slot from reporter id {}",
                    id
                ),
            )
            .unwrap(),
        }
    }
}
