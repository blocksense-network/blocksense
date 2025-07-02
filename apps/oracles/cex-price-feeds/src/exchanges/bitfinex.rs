use anyhow::Result;
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;

use blocksense_data_providers_sdk::price_data::traits::prices_fetcher::{
    PairPriceData, PricePoint, PricesFetcher,
};
use blocksense_sdk::http::http_get_json;

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
        // When the symbol ( label ) is with more than 3 characters,
        // the API uses the format for the trading pair "t[Symbol1]:[Symbol2]"
        let no_delimiter = self.symbol.replace(":", "");
        // The API uses label `UST` for symbol `USDT` and `UDC` for symbol `USDC`
        // ref: https://api-pub.bitfinex.com/v2/conf/pub:map:currency:label
        no_delimiter.replace("UST", "USDT").replace("UDC", "USDC")
    }

    fn price(&self) -> f64 {
        self.last_price
    }

    fn volume(&self) -> f64 {
        self.volume
    }
}

pub struct BitfinexPriceFetcher<'a> {
    pub symbols: &'a [String],
}

impl<'a> PricesFetcher<'a> for BitfinexPriceFetcher<'a> {
    const NAME: &'static str = "Bitfinex";

    fn new(symbols: &'a [String], _api_key: Option<&'a str>) -> Self {
        Self { symbols }
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let all_symbols = self.symbols.join(",");

            let response = http_get_json::<Vec<TradingPairTicker>>(
                "https://api-pub.bitfinex.com/v2/tickers",
                Some(&[("symbols", all_symbols.as_str())]),
                None,
            )
            .await?;

            Ok(response
                .into_iter()
                .map(|ticker| {
                    (
                        // Remove 't' prefix from the symbol
                        ticker
                            .symbol()
                            .strip_prefix("t")
                            .unwrap_or(&ticker.symbol)
                            .to_string(),
                        PricePoint {
                            price: ticker.price(),
                            volume: ticker.volume(),
                        },
                    )
                })
                .collect())
        }
        .boxed_local()
    }
}
