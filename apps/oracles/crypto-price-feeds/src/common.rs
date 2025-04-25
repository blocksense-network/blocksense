use std::collections::HashMap;

use serde::{Deserialize, Serialize};

pub type ExchangeName = String;
pub type TradingPairSymbol = String;
pub type Price = f64;
pub type Volume = f64;

#[derive(Debug, Hash, Serialize, Deserialize)]
pub struct TradingPair {
    pub base: String,
    pub quote: String,
}

#[derive(Clone, Debug)]
pub struct PricePoint {
    pub price: Price,
    pub volume: Volume,
}

pub type ExchangePricePoints = HashMap<ExchangeName, PricePoint>;
pub type PairPriceData = HashMap<TradingPairSymbol, PricePoint>;

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
