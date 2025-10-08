use blocksense_data_providers_sdk::price_data::types::{PricePair, ProvidersSymbols};

#[derive(Debug)]
pub struct ResourcePairData {
    pub pair: PricePair,
    pub id: String,
    pub symbols_per_exchange: ProvidersSymbols,
}

#[derive(Debug)]
pub struct ResourceData {
    pub pairs: Vec<ResourcePairData>,
    pub all_symbols: ProvidersSymbols,
}
