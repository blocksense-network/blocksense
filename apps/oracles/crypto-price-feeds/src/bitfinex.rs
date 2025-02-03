use anyhow::Result;
use blocksense_sdk::spin::http::{send, Method, Request, Response};
use std::collections::HashMap;

use serde::{Deserialize, Deserializer};
use serde_json::{from_value, Value};

use url::Url;

use crate::common::{fill_results, ResourceData, ResourceResult};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct TradingPairTicker {
    pub symbol: String,             // e.g., "tBTCUSD"
    pub bid: f64,                   // Best bid price
    pub bid_size: f64,              // Amount available at best bid price
    pub ask: f64,                   // Best ask price
    pub ask_size: f64,              // Amount available at best ask price
    pub daily_change: f64,          // Amount that the last price has changed since yesterday
    pub daily_change_relative: f64, // Relative price change since yesterday
    pub last_price: f64,            // Last traded price
    pub volume: f64,                // 24h trading volume
    pub high: f64,                  // 24h high price
    pub low: f64,                   // 24h low price
}

impl TradingPairTicker {
    fn symbol(&self) -> String {
        // For trading pairs the API uses the format "t[Symbol]"
        let no_t_prefix = self.symbol.replace("t", "").to_string();
        // When the symbol ( label ) is with more than 3 characters,
        // the API uses the format for the trading pair "t[Symbol1]:[Symbol2]"
        let no_delimiter = no_t_prefix.replace(":", "");
        // The API uses label `UST` for symbol `USDT` and `UDC` for symbol `USDC`
        // ref: https://api-pub.bitfinex.com/v2/conf/pub:map:currency:label
        no_delimiter.replace("UST", "USDT").replace("UDC", "USDC")
    }

    fn price(&self) -> String {
        self.last_price.to_string()
    }
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct FundingCurrencyTicker {
    pub symbol: String,                 // e.g., "fUSD"
    pub frr: f64,                       // Flash Return Rate (0 if none)
    pub bid: f64,                       // Best bid price
    pub bid_period: Option<i32>,        // Bid period in days (can be null)
    pub bid_size: f64,                  // Amount available at best bid price
    pub ask: f64,                       // Best ask price
    pub ask_period: Option<i32>,        // Ask period in days (can be null)
    pub ask_size: f64,                  // Amount available at best ask price
    pub daily_change: f64,              // Amount that the last price has changed since yesterday
    pub daily_change_relative: f64,     // Relative price change since yesterday
    pub last_price: f64,                // Last traded price
    pub volume: f64,                    // 24h trading volume
    pub high: f64,                      // 24h high price
    pub low: f64,                       // 24h low price
    pub funding_rate: Option<f64>,      // Funding rate, can be null
    pub funding_period: Option<f64>,    // Funding period, can be null
    pub funding_available: Option<f64>, // Funding available size, can be null
}

#[derive(Debug, Clone, PartialEq)]
pub enum BitfinexPrice {
    Trading(TradingPairTicker),
    Funding(FundingCurrencyTicker),
}

impl<'de> Deserialize<'de> for BitfinexPrice {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value: Value = Deserialize::deserialize(deserializer)?;

        // Ensure the value is an array
        let array = value
            .as_array()
            .ok_or_else(|| serde::de::Error::custom("Expected an array"))?;

        // Match the array size to determine the struct
        match array.len() {
            11 => from_value::<TradingPairTicker>(value)
                .map(BitfinexPrice::Trading)
                .map_err(serde::de::Error::custom),
            17 => from_value::<FundingCurrencyTicker>(value)
                .map(BitfinexPrice::Funding)
                .map_err(serde::de::Error::custom),
            _ => Err(serde::de::Error::custom("Unknown ticker format")),
        }
    }
}
