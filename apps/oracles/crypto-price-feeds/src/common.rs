use std::collections::HashMap;

pub const USD_SYMBOLS: [&str; 3] = ["USD", "USDC", "USDT"];

pub type ExchangeName = String;
pub type TradingPair = String;
pub type Price = f64;
pub type Volume = f64;

#[derive(Clone, Debug)]
pub struct PricePoint {
    pub price: Price,
    pub volume: Volume,
}

pub type ExchangePricePoints = HashMap<ExchangeName, PricePoint>;
pub type PairPriceData = HashMap<TradingPair, PricePoint>;

#[derive(Clone, Debug)]
pub struct ExchangePriceData {
    pub name: ExchangeName,
    pub data: PairPriceData,
}

pub type TradingPairToResults = HashMap<TradingPair, DataFeedResult>;

#[derive(Debug, Hash)]
pub struct ResourceData {
    pub symbol: String,
    pub id: String,
}

#[derive(Debug, Default)]
pub struct DataFeedResult {
    pub symbol: String,
    pub exchanges_data: ExchangePricePoints,
}
