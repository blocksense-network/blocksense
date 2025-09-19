use serde::{Deserialize, Serialize};

use blocksense_data_providers_sdk::price_data::types::{PricePair, ProvidersSymbols};
use blocksense_sdk::oracle::logging::PriceFeedResource;

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

impl PriceFeedResource for ResourcePairData {
    fn get_id(&self) -> &str {
        &self.id
    }
    fn get_pair_display(&self) -> String {
        format!("{} / {}", self.pair.base, self.pair.quote)
    }
}

/* Oracle results related types */
