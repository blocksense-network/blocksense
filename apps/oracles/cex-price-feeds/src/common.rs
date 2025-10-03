use blocksense_data_providers_sdk::price_data::types::{PricePair, ProvidersSymbols};
use blocksense_sdk::oracle::logging::PriceFeedResource;

#[derive(Debug)]
pub struct ResourcePairData {
    pub pair: PricePair,
    pub id: String,
}

#[derive(Debug)]
pub struct ResourceData {
    pub pairs: Vec<ResourcePairData>,
    pub symbols: ProvidersSymbols,
}

impl PriceFeedResource for ResourcePairData {
    fn get_id(&self) -> &str {
        &self.id
    }

    fn get_pair_display(&self) -> String {
        format!("{} / {}", self.pair.base, self.pair.quote)
    }
}
