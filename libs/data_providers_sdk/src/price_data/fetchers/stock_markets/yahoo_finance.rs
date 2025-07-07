use std::collections::HashMap;

use anyhow::{Error, Result};
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;
use serde_json::Value;

use blocksense_sdk::http::http_get_json;

use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceData {
    pub symbol: String,
    pub regular_market_previous_close: Option<f64>,
    pub regular_market_price: Option<f64>,
    pub regular_market_volume: Option<f64>,
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

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let api_key = self
                .api_keys
                .as_ref()
                .and_then(|map| map.get("YAHOO_FINANCE_API_KEY"))
                .ok_or_else(|| Error::msg("Missing YAHOO_FINANCE_API_KEY"))?;

            let all_symbols = self.symbols.join(",");

            let response = http_get_json::<YFResponse>(
                "https://yfapi.net/v6/finance/quote",
                Some(&[("symbols", all_symbols.as_str())]),
                Some(&[("x-api-key", api_key)]),
            )
            .await?;

            let results = response
                .quote_response
                .ok_or_else(|| Error::msg("YahooFinance: No quote response"))?
                .result
                .into_iter()
                .filter_map(|value| {
                    let price = value
                        .regular_market_price
                        .or(value.regular_market_previous_close);

                    let volume = value.regular_market_volume;

                    match (price, volume) {
                        (Some(price), Some(volume)) => {
                            Some((value.symbol, PricePoint { price, volume }))
                        }
                        _ => {
                            eprintln!(
                                "[YahooFinance] Skipping symbol {}: missing {}{}{}",
                                value.symbol,
                                if price.is_none() { "price" } else { "" },
                                if price.is_none() && volume.is_none() {
                                    " and "
                                } else {
                                    ""
                                },
                                if volume.is_none() { "volume" } else { "" },
                            );
                            None
                        }
                    }
                })
                .collect();

            Ok(results)
        }
        .boxed_local()
    }
}
