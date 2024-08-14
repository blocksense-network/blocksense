#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum DataFeedAPI {
    EmptyAPI,
    YahooFinanceDataFeed,
    CoinMarketCapDataFeed,
    // OpenWeather,
}

impl DataFeedAPI {
    pub fn as_str(&self) -> &'static str {
        match *self {
            DataFeedAPI::EmptyAPI => "None",
            DataFeedAPI::YahooFinanceDataFeed => "YahooFinance",
            DataFeedAPI::CoinMarketCapDataFeed => "CoinMarketCap",
        }
    }

    pub fn from_str(string: &str) -> Self {
        match string {
            "YahooFinance" => DataFeedAPI::YahooFinanceDataFeed,
            "CoinMarketCap" => DataFeedAPI::CoinMarketCapDataFeed,
            // "OpenWeather" => DataFeedAPI::OpenWeather,
            _ => DataFeedAPI::EmptyAPI,
        }
    }
}
