use std::collections::HashMap;

use anyhow::Result;

use futures::{future::LocalBoxFuture, FutureExt};
use serde::Deserialize;

use blocksense_sdk::http::http_get_json;

use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct UpBitTickerResponseData {
    pub market: String,
    pub trade_price: f64,
    pub acc_trade_volume_24h: f64,
}

type UpBitResponse = Vec<UpBitTickerResponseData>;

pub struct UpBitPriceFetcher<'a> {
    pub symbols: &'a [String],
}

impl<'a> PricesFetcher<'a> for UpBitPriceFetcher<'a> {
    const NAME: &'static str = "UpBit";

    fn new(symbols: &'a [String], _api_keys: Option<HashMap<String, String>>) -> Self {
        Self { symbols }
    }

    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<'_, Result<PairPriceData>> {
        async move {
            let all_markets = self.symbols.join(",");
            let response = http_get_json::<UpBitResponse>(
                "https://api.upbit.com/v1/ticker",
                Some(&[("markets", all_markets.as_str())]),
                None,
                Some(timeout_secs),
            )
            .await?;

            Ok(response
                .into_iter()
                .map(|data| {
                    let parts: Vec<&str> = data.market.split('-').collect();
                    let transformed_market = format!("{}{}", parts[1], parts[0]);
                    (
                        transformed_market,
                        PricePoint {
                            price: data.trade_price,
                            volume: data.acc_trade_volume_24h,
                        },
                    )
                })
                .collect())
        }
        .boxed_local()
    }
}
