use std::collections::HashMap;

use blocksense_sdk::traits::prices_fetcher::{PairPriceData, PricePoint, TradingPairSymbol};
use serde::{Deserialize, Serialize};

pub type ExchangeName = String;

#[derive(Debug, Hash, Serialize, Deserialize)]
pub struct TradingPair {
    pub base: String,
    pub quote: String,
}

pub type ExchangePricePoints = HashMap<ExchangeName, PricePoint>;

pub type ExchangesSymbols = HashMap<ExchangeName, Vec<String>>;

#[derive(Clone, Debug)]
pub struct ExchangePriceData {
    pub name: ExchangeName,
    pub data: PairPriceData,
}

pub type TradingPairToResults = HashMap<TradingPairSymbol, DataFeedResult>;

#[derive(Debug)]
pub struct ResourcePairData {
    pub pair: TradingPair,
    pub id: String,
}

#[derive(Debug)]
pub struct ResourceData {
    pub pairs: Vec<ResourcePairData>,
    pub symbols: ExchangesSymbols,
}

#[derive(Debug, Default)]
pub struct DataFeedResult {
    pub symbol: String,
    pub exchanges_data: ExchangePricePoints,
}
