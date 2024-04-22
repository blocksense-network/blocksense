pub enum ConsensusMetric {
    Median,
    Mean,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum DataFeedAPI {
    EmptyAPI,
    YahooFinance,
    CoinMarketCap,
    // OpenWeather,
}
