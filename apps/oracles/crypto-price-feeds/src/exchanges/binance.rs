use anyhow::Result;

use futures::{future::LocalBoxFuture, FutureExt};
use serde::Deserialize;

use crate::{common::PairPriceData, http::http_get_json, traits::prices_fetcher::PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BinancePriceData {
    pub symbol: String,
    pub price: String,
}

type BinancePriceResponse = Vec<BinancePriceData>;

pub struct BinancePriceFetcher;

impl PricesFetcher for BinancePriceFetcher {
    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<BinancePriceResponse>(
                "https://api.binance.com/api/v3/ticker/price",
                None,
            )
            .await?;

            Ok(response
                .into_iter()
                .map(|value| (value.symbol, value.price))
                .collect())
        }
        .boxed_local()
    }
}
