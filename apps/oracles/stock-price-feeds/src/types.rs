use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use blocksense_sdk::traits::prices_fetcher::{PairPriceData, PricePoint, TradingPairSymbol};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pair {
    pub base: String,
    pub quote: String,
}

pub type ProviderName = String;

// A mapping of provider names to the respective symbols they support
pub type ProvidersSymbols = HashMap<ProviderName, Vec<String>>;

// A mapping of provider names to information about the price
pub type ProvidersPricePoints = HashMap<ProviderName, PricePoint>;

#[derive(Clone, Debug)]
pub struct ProviderPriceData {
    pub name: ProviderName,
    pub data: PairPriceData,
}

/* Feed configuration data related types */

#[derive(Debug, Serialize, Deserialize)]
pub struct ProvidersConfig {
    pub providers: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FeedConfigData {
    pub pair: Pair,
    pub arguments: ProvidersConfig,
}

/*  Oracle resource data related types */

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourcePairData {
    pub pair: Pair,
    pub id: String,
}

#[derive(Debug)]
pub struct ResourceData {
    pub pairs: Vec<ResourcePairData>,
    pub symbols: ProvidersSymbols,
}

pub type Capabilities = HashMap<String, String>;

/* Oracle results related types */

#[derive(Debug, Default)]
pub struct DataFeedResult {
    pub symbol: String,
    pub providers_data: ProvidersPricePoints,
}

// A mapping of feed pairs to their respective results
pub type PairToResults = HashMap<TradingPairSymbol, DataFeedResult>;
