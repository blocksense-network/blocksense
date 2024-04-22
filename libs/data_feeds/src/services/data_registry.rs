use std::collections::HashMap;
use crate::types::DataFeedAPI;

lazy_static::lazy_static! {
    static ref ASSETS_MAP: HashMap<DataFeedAPI, Vec<&'static str>> = {
        let mut map = HashMap::new();
        map.insert(DataFeedAPI::YahooFinance, vec![
            "AAPL","GOOGL","TSLA","IBKR","NVDA","TLRY", "AMD"
            ]);
        map.insert(DataFeedAPI::CoinMarketCap, vec!["BTC", "ETH","SOL", "DOT", "XRP"]);

        map
    };
    
}

impl DataFeedAPI {

    pub fn assets(&self) -> &[&'static str] {
        &ASSETS_MAP[self]

    }

    pub fn get_all_feeds() -> Vec<(DataFeedAPI, String)> {
        ASSETS_MAP
            .iter()
            .flat_map(|(key, assets)| {
                assets.iter().map(move |asset| {
                    (key.clone(), asset.to_string())
                })
            })
            .collect()
    }

    pub fn as_str(&self) -> &'static str {
        match *self {
            DataFeedAPI::EmptyAPI => "None",
            DataFeedAPI::YahooFinance => "YahooFinance",
            DataFeedAPI::CoinMarketCap => "CoinMarketCap",
        }
    }
}

