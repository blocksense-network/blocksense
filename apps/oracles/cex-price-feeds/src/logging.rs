use blocksense_data_providers_sdk::price_data::types::{PairsToResults, ResultsView};
use blocksense_sdk::oracle::{
    logging::{print_oracle_results, LoggingConfig, ResourceLogEntry},
    Payload,
};

use crate::common::ResourcePairData;

impl ResourceLogEntry for ResourcePairData {
    fn get_id_str(&self) -> String {
        self.id.clone()
    }

    fn get_display_name(&self) -> String {
        format!("{} / {}", self.pair.base, self.pair.quote)
    }
}

pub fn print_results(resources: &[ResourcePairData], results: &PairsToResults, payload: &Payload) {
    let view = ResultsView(results);
    print_oracle_results(
        resources,
        payload,
        LoggingConfig::with_additional_results_analysis(&view),
    );
}
