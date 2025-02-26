use std::collections::HashMap;

pub const USD_SYMBOLS: [&str; 3] = ["USD", "USDC", "USDT"];

pub type TradingPair = String;
pub type Price = f64;
pub type Volume = f64;

#[derive(Debug)]
pub struct PricePoint {
    pub price: Price,
    pub volume: Volume,
}

pub type PairPriceData = HashMap<TradingPair, PricePoint>;
pub type TradingPairToResults = HashMap<TradingPair, Vec<ResourceResult>>;

#[derive(Debug, Hash)]
pub struct ResourceData {
    pub symbol: String,
    pub id: String,
}

#[derive(Debug)]
#[allow(dead_code)] // We are not using this struct yet.
pub struct ResourceResult {
    pub id: String,
    pub symbol: String,
    pub usd_symbol: String,
    pub price: f64,
    //TODO(adikov): Add balance information when we start getting it.
}
