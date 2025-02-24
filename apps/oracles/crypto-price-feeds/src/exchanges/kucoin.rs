use anyhow::Result;
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;

use crate::{common::PairPriceData, http::http_get_json, traits::prices_fetcher::PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KuCoinPrice {
    pub symbol: String,
    pub last: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KuCoinResult {
    pub ticker: Vec<KuCoinPrice>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KuCoinPriceResponse {
    pub code: String,
    pub data: KuCoinResult,
}

pub struct KuCoinPriceFetcher;

impl PricesFetcher for KuCoinPriceFetcher {
    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<KuCoinPriceResponse>(
                "https://api.kucoin.com/api/v1/market/allTickers",
                None,
            )
            .await?;

            Ok(response
                .data
                .ticker
                .into_iter()
                .filter(|value| value.last.is_some())
                // KuCoin have symbols in format "X-Y". We need to match logic in `fill_results`
                .map(|value| (value.symbol.replace("-", ""), value.last.unwrap()))
                .collect())
        }
        .boxed_local()
    }
}
