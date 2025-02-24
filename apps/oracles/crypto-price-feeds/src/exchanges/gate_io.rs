use anyhow::Result;
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;

use crate::{common::PairPriceData, http::http_get_json, traits::prices_fetcher::PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct GateIoPriceData {
    pub currency_pair: String,
    pub last: String,
}

type GateIoPriceResponse = Vec<GateIoPriceData>;

pub struct GateIoPriceFetcher;

impl PricesFetcher for GateIoPriceFetcher {
    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let response = http_get_json::<GateIoPriceResponse>(
                "https://api.gateio.ws/api/v4/spot/tickers",
                None,
            )
            .await?;

            Ok(response
                .into_iter()
                .map(|value| (value.currency_pair.replace("_", ""), value.last))
                .collect())
        }
        .boxed_local()
    }
}
