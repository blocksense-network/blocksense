use anyhow::Result;
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;

use crate::{common::PairPriceData, http::http_get_json, traits::prices_fetcher::PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CryptoComPriceData {
    pub i: String,
    pub a: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CryptoComResult {
    pub data: Vec<CryptoComPriceData>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CryptoComPriceResponse {
    pub code: i8,
    pub result: CryptoComResult,
}

pub struct CryptoComPriceFetcher;

impl PricesFetcher<'_> for CryptoComPriceFetcher {
    const NAME: &'static str = "Crypto.com";

    fn new(_symbols: &[String]) -> Self {
        Self
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<CryptoComPriceResponse>(
                "https://api.crypto.com/exchange/v1/public/get-tickers",
                None,
            )
            .await?;

            Ok(response
                .result
                .data
                .into_iter()
                //  we should consider what to do with perp
                .filter(|value| !value.i.contains("-PERP"))
                .map(|value| (value.i.replace("_", ""), value.a))
                .collect())
        }
        .boxed_local()
    }
}
