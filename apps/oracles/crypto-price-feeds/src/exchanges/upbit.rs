use anyhow::Result;

use futures::{future::LocalBoxFuture, FutureExt};
use serde::Deserialize;

use crate::{
    common::{PairPriceData, PricePoint},
    http::http_get_json,
    traits::prices_fetcher::PricesFetcher,
};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct UpBitMarketResponseData {
    pub market: String,
}

type UpBitMarketResponse = Vec<UpBitMarketResponseData>;

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct UpBitTickerResponseData {
    pub market: String,
    pub trade_price: f64,
}

type UpBitResponse = Vec<UpBitTickerResponseData>;

pub struct UpBitPriceFetcher<'a> {
    pub symbols: &'a [String],
}

impl<'a> PricesFetcher<'a> for UpBitPriceFetcher<'a> {
    const NAME: &'static str = "UpBit";

    fn new(symbols: &'a [String]) -> Self {
        Self { symbols }
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let all_markets = self.symbols.join(",");
            let response = http_get_json::<UpBitResponse>(
                "https://api.upbit.com/v1/ticker",
                Some(&[("markets", all_markets.as_str())]),
            )
            .await?;

            Ok(response
                .into_iter()
                .map(|price| {
                    let parts: Vec<&str> = price.market.split('-').collect();
                    let transformed_market = format!("{}{}", parts[1], parts[0]);
                    (
                        transformed_market,
                        PricePoint {
                            price: price.trade_price,
                            volume: 1.0,
                        },
                    )
                })
                .collect())
        }
        .boxed_local()
    }
}

pub async fn get_upbit_market() -> Result<Vec<String>> {
    let response =
        http_get_json::<UpBitMarketResponse>("https://api.upbit.com/v1/market/all", None).await?;

    Ok(response.into_iter().map(|market| market.market).collect())
}
