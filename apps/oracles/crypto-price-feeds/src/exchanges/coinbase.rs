use anyhow::Result;
use futures::{future::LocalBoxFuture, FutureExt};
use std::collections::HashMap;

use serde::Deserialize;

use crate::{
    common::{PairPriceData, PricePoint},
    http::http_get_json,
    traits::prices_fetcher::PricesFetcher,
};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CoinbasePriceData {
    pub currency: String,
    pub rates: HashMap<String, String>,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct CoinbasePriceResponse {
    pub data: CoinbasePriceData,
}

pub struct CoinbasePriceFetcher;

impl PricesFetcher<'_> for CoinbasePriceFetcher {
    const NAME: &'static str = "Coinbase";

    fn new(_symbols: &[String]) -> Self {
        Self
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<CoinbasePriceResponse>(
                "https://api.coinbase.com/v2/exchange-rates",
                Some(&[("currency", "USD")]),
            )
            .await?;

            Ok(response
                .data
                .rates
                .into_iter()
                .filter_map(|(asset, price)| match price.parse::<f64>() {
                    Ok(price_as_number) => {
                        let price = 1.0 / price_as_number;
                        let pair = format!("{}{}", asset, "USD");
                        Some((pair, PricePoint { price, volume: 1.0 }))
                    }
                    Err(_) => None,
                })
                .collect())
        }
        .boxed_local()
    }
}
