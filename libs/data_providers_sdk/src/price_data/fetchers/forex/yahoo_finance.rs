use std::collections::HashMap;

use anyhow::{Error, Result};
use futures::future::try_join_all;
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;
use serde_json::Value;

use blocksense_sdk::http::http_get_json;

use crate::price_data::{
    fetchers::stock_markets::utils::print_missing_provider_price_data,
    traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher},
};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceData {
    pub symbol: String,
    pub regular_market_previous_close: Option<f64>,
    pub regular_market_price: Option<f64>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteResponse {
    pub result: Vec<PriceData>,
    pub error: Value,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YFResponse {
    pub quote_response: Option<QuoteResponse>,
}

pub struct YFPriceFetcher<'a> {
    pub symbols: &'a [String],
    api_keys: Option<HashMap<String, String>>,
}

impl<'a> PricesFetcher<'a> for YFPriceFetcher<'a> {
    const NAME: &'static str = "YahooFinance";

    fn new(symbols: &'a [String], api_keys: Option<HashMap<String, String>>) -> Self {
        Self { symbols, api_keys }
    }

    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<Result<PairPriceData>> {
        async move {
            let api_key = self
                .api_keys
                .as_ref()
                .and_then(|map| map.get("YAHOO_FINANCE_API_KEY"))
                .ok_or_else(|| Error::msg("Missing YAHOO_FINANCE_API_KEY"))?;

            let api_key_str = api_key.as_str();
            let futures = self.symbols.chunks(10).map(|chunk| {
                let symbols_param = chunk
                    .iter()
                    .map(|s| format!("{}=X", s.replace(':', "")))
                    .collect::<Vec<String>>()
                    .join(",");

                async move {
                    http_get_json::<YFResponse>(
                        "https://yfapi.net/v6/finance/quote",
                        Some(&[("symbols", symbols_param.as_str())]),
                        Some(&[("x-api-key", api_key_str)]),
                        Some(timeout_secs),
                    )
                    .await
                }
            });

            let responses = try_join_all(futures).await?;

            let mut aggregated: PairPriceData = HashMap::new();
            for response in responses.into_iter() {
                let quote_response = response
                    .quote_response
                    .ok_or_else(|| Error::msg("YahooFinance: No quote response"))?;

                for value in quote_response.result.into_iter() {
                    let price = value
                        .regular_market_price
                        .or(value.regular_market_previous_close);

                    let volume = 1.0;
                    let symbol = value.symbol.replace("=X", "");
                    match price {
                        Some(price) => {
                            aggregated.insert(symbol, PricePoint { price, volume });
                        }
                        _ => {
                            print_missing_provider_price_data(
                                "YahooFinance",
                                value.symbol.clone(),
                                price,
                                Some(volume),
                            );
                        }
                    }
                }
            }

            Ok(aggregated)
        }
        .boxed_local()
    }
}
