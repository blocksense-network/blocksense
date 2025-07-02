use blocksense_data_providers_sdk::price_data::types::{PricePair, ProvidersSymbols};

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
