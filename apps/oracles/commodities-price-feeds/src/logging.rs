use blocksense_data_providers_sdk::price_data::types::PairsToResults;
use blocksense_sdk::oracle::{
    logging::{print_price_feed_results, PriceResultsAccessor},
    Payload,
};
use itertools::Itertools;

use crate::domain::ResourcePairData;

struct ResultsView<'a>(&'a PairsToResults);

impl<'a> PriceResultsAccessor for ResultsView<'a> {
    fn has(&self, id: &str) -> bool {
        self.0.get(id).is_some()
    }
    fn provider_names(&self, id: &str) -> Vec<String> {
        self.0
            .get(id)
            .map(|res| {
                res.providers_data
                    .keys()
                    .map(|x| x.split(' ').next().unwrap_or("").to_string())
                    .unique()
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default()
    }
}

pub fn print_results(resources: &[ResourcePairData], results: &PairsToResults, payload: &Payload) {
    let view = ResultsView(results);
    print_price_feed_results(resources, &view, payload, "Providers", "provider", false);
}
