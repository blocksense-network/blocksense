use serde::{Deserialize, Serialize};

use blocksense_data_providers_sdk::price_data::types::{PricePair, ProvidersSymbols};

/* Feed configuration data related types */

#[derive(Debug, Serialize, Deserialize)]
pub struct ProvidersConfig {
    pub providers: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FeedConfigData {
    pub pair: PricePair,
    pub arguments: ProvidersConfig,
}

/*  Oracle resource data related types */

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourcePairData {
    pub pair: PricePair,
    pub id: String,
}

#[derive(Debug)]
pub struct ResourceData {
    pub pairs: Vec<ResourcePairData>,
    pub symbols: ProvidersSymbols,
}


/* Oracle results related types */
