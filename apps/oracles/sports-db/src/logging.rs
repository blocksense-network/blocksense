use blocksense_sdk::oracle::{
    logging::{print_oracle_results, LoggingConfig, ResourceLogEntry},
    Payload,
};

use crate::FeedConfig;

impl ResourceLogEntry for FeedConfig {
    fn get_id_str(&self) -> String {
        self.feed_id.to_string()
    }
    fn get_display_name(&self) -> String {
        format!(
            "{} Sports Results for Team ID: {} (Sport Type: {})",
            self.feed_id, self.arguments.team_id, self.arguments.sport_type
        )
    }
}

pub fn print_payload(payload: &Payload, resources: &[FeedConfig]) {
    print_oracle_results(resources, payload, LoggingConfig::basic());
}
