use blocksense_sdk::oracle::{
    logging::{print_oracle_results, LoggingConfig, ResourceLogEntry},
    Payload,
};

use crate::domain::FeedConfig;

impl ResourceLogEntry for FeedConfig {
    fn get_id_str(&self) -> String {
        self.id.to_string()
    }

    fn get_display_name(&self) -> String {
        format!("{} Gas Price in Gwei", self.arguments.metric)
    }
}

pub fn print_results(resources: &[FeedConfig], payload: &Payload) {
    print_oracle_results(resources, payload, LoggingConfig::basic());
}
