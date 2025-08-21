use std::collections::HashMap;

use anyhow::{Error, Result};
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;
use serde_this_or_that::as_f64;

use blocksense_sdk::http::http_get_json;

use crate::price_data::{
    fetchers::stock_markets::utils::print_missing_network_price_data,
    traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher},
};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyBar {
    #[serde(deserialize_with = "as_f64")]
    pub v: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestTrade {
    #[serde(deserialize_with = "as_f64")]
    pub p: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceData {
    pub latest_trade: LatestTrade,
    pub daily_bar: DailyBar,
}

pub type AlpacaMarketsResponse = HashMap<String, PriceData>;

pub struct AlpacaMarketsPriceFetcher<'a> {
    pub symbols: &'a [String],
    api_keys: Option<HashMap<String, String>>,
}

impl<'a> PricesFetcher<'a> for AlpacaMarketsPriceFetcher<'a> {
    const NAME: &'static str = "AlpacaMarkets";

    fn new(symbols: &'a [String], api_keys: Option<HashMap<String, String>>) -> Self {
        Self { symbols, api_keys }
    }

    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<Result<PairPriceData>> {
        async move {
            let api_key_id = self
                .api_keys
                .as_ref()
                .and_then(|map| map.get("APCA_API_KEY_ID"))
                .ok_or_else(|| Error::msg("Missing APCA_API_KEY_ID"))?;

            let api_secret_key = self
                .api_keys
                .as_ref()
                .and_then(|map| map.get("APCA_API_SECRET_KEY"))
                .ok_or_else(|| Error::msg("Missing APCA_API_SECRET_KEY"))?;

            let all_symbols = self.symbols.join(",");

            let response = http_get_json::<AlpacaMarketsResponse>(
                "https://data.alpaca.markets/v2/stocks/snapshots",
                Some(&[("symbols", &all_symbols)]),
                Some(&[
                    ("APCA-API-KEY-ID", api_key_id),
                    ("APCA-API-SECRET-KEY", api_secret_key),
                ]),
                Some(timeout_secs),
            )
            .await?;

            let results = response
                .into_iter()
                .filter_map(|(symbol, data)| {
                    let price = data.latest_trade.p;
                    let volume = data.daily_bar.v;

                    if price > 0.0 && volume > 0.0 {
                        Some((symbol, PricePoint { price, volume }))
                    } else {
                        print_missing_network_price_data(
                            "AlpacaMarkets",
                            symbol,
                            (price > 0.0).then_some(price),
                            (volume > 0.0).then_some(volume),
                        );
                        None
                    }
                })
                .collect();

            Ok(results)
        }
        .boxed_local()
    }
}
