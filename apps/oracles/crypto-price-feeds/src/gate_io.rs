use anyhow::{Ok, Result};
use blocksense_sdk::spin::http::{send, Response};

use serde::Deserialize;

use crate::common::{Fetcher, PairPriceData};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct GateIoPriceData {
    pub currency_pair: String,
    pub last: String,
}

type GateIoPriceResponse = Vec<GateIoPriceData>;

struct GateIoFetcher;

impl Fetcher for GateIoFetcher {
    type ParsedResponse = PairPriceData;
    type ApiResponse = GateIoPriceResponse;

    fn parse_response(&self, value: Self::ApiResponse) -> Result<Self::ParsedResponse> {
        let response: Self::ParsedResponse = value
            .into_iter()
            .map(|value| (value.currency_pair.replace("_", ""), value.last))
            .collect();

        Ok(response)
    }
}

pub async fn get_gate_io_prices() -> Result<PairPriceData> {
    let fetcher = GateIoFetcher {};
    let req = fetcher.prepare_get_request("https://api.gateio.ws/api/v4/spot/tickers", None);
    let resp: Response = send(req?).await?;
    let deserialized = fetcher.deserialize_response(resp)?;
    let pair_prices: PairPriceData = fetcher.parse_response(deserialized)?;

    Ok(pair_prices)
}
