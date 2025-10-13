use std::collections::HashMap;

use blocksense_sdk::oracle::logging::PriceResultsAccessor;
use itertools::Itertools;
use serde::{Deserialize, Serialize};

use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, TradingPairSymbol};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricePair {
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

#[derive(Debug, Default)]
pub struct DataFeedResult {
    pub symbol: String,
    pub providers_data: ProvidersPricePoints,
}

// A mapping of feed pairs to their respective results
pub type PairsToResults = HashMap<TradingPairSymbol, DataFeedResult>;

// Utility struct to provide read-only access to the results
// Used for logging purposes
pub struct ResultsView<'a>(pub &'a PairsToResults);

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
