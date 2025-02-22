use anyhow::Result;

use futures::FutureExt;
use serde::Deserialize;

use crate::{common::PairPriceData, http::http_get_json, traits::prices_fetcher::PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BitgetPriceData {
    pub symbol: String,
    pub close: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BitgetPriceResponse {
    pub code: String,
    pub data: Vec<BitgetPriceData>,
}
pub struct BitgetPriceFetcher;

impl PricesFetcher for BitgetPriceFetcher {
    fn fetch(&self) -> futures::future::LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<BitgetPriceResponse>(
                "https://api.bitget.com/api/spot/v1/market/tickers",
                None,
            )
            .await?;

            Ok(response
                .data
                .into_iter()
                .map(|value| (value.symbol, value.close))
                .collect())
        }
        .boxed_local()
    }
}
