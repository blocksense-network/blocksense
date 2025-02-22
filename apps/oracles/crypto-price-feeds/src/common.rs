use std::collections::HashMap;

pub const USD_SYMBOLS: [&str; 3] = ["USD", "USDC", "USDT"];

pub type PairPriceData = HashMap<String, String>;

#[derive(Debug)]
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
    pub result: String,
    //TODO(adikov): Add balance information when we start getting it.
}
