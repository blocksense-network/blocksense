use std::collections::HashMap;

pub const USD_SYMBOLS: [&str; 3] = ["USD", "USDC", "USDT"];

pub type TradingPair = String;
pub type Price = String;
pub type PairPriceData = HashMap<TradingPair, Price>;
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
    pub price: String,
    //TODO(adikov): Add balance information when we start getting it.
}
