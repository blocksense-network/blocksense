use strum_macros::EnumIter;

#[derive(Debug, Clone, PartialEq, Eq, Hash, EnumIter)]
pub enum DataFeedAPI {
    EmptyAPI,
    YahooFinanceDataFeed,
    CoinMarketCapDataFeed,
    // OpenWeather,
}

impl DataFeedAPI {
    pub fn get_as_str(&self) -> &'static str {
        match *self {
            DataFeedAPI::EmptyAPI => "None",
            DataFeedAPI::YahooFinanceDataFeed => "YahooFinance",
            DataFeedAPI::CoinMarketCapDataFeed => "CoinMarketCap",
        }
    }

    pub fn get_from_str(string: &str) -> Self {
        match string {
            "YahooFinance" => DataFeedAPI::YahooFinanceDataFeed,
            "CoinMarketCap" => DataFeedAPI::CoinMarketCapDataFeed,
            // "OpenWeather" => DataFeedAPI::OpenWeather,
            _ => DataFeedAPI::EmptyAPI,
        }
    }
}
