use std::{collections::HashMap, ops::Deref};

use anyhow::Result;
use futures::{
    future::LocalBoxFuture,
    stream::{FuturesUnordered, StreamExt},
    FutureExt,
};
use itertools::Itertools;
use serde::Deserialize;
use serde_this_or_that::as_f64;

use blocksense_sdk::http::http_get_json;

use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct HyperdriveRateData {
    pub chain_id: u32,
    pub market_id: u32,
    #[serde(deserialize_with = "as_f64")]
    pub borrow_rate: f64,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct HyperdriveRatesResponse {
    pub data: Vec<HyperdriveRateData>,
}

// pub struct HyperdriveRateFetcher<'a> {
//     pub symbols: &'a [String],
// }

// impl<'a> PricesFetcher<'a> for HyperdriveRateFetcher<'a> {
//     const NAME: &'static str = "Hyperdrive";

//     fn new(symbols: &'a [String], _api_keys: Option<HashMap<String, String>>) -> Self {
//         Self { symbols }
//     }

//     fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
//         async {
//             let rates_futures = self
//                 .symbols
//                 .iter()
//                 .map(Deref::deref)
//                 .map(fetch_rates_for_market);

//             let mut futures = FuturesUnordered::from_iter(rates_futures);
//             let mut rates = PairPriceData::new();

//             while let Some(result) = futures.next().await {
//                 if let Ok((symbol, price_point)) = result {
//                     rates.insert(symbol, price_point);
//                 }
//             }

//             Ok(rates)
//         }
//         .boxed_local()
//     }
// }

pub async fn fetch_rates_for_market(market_id: &str) -> Result<HyperdriveRatesResponse> {
    let url = format!("https://api.hyperdrive.fi/markets/999/{market_id}/rates");
    let response = http_get_json::<HyperdriveRatesResponse>(&url, None, None).await;

    response
}
