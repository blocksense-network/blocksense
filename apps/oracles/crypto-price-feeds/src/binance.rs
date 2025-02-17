use anyhow::Result;

use blocksense_sdk::spin::http::{send, Request, Response};
use futures::future::{BoxFuture, LocalBoxFuture};
use serde::{de::DeserializeOwned, Deserialize};

use crate::common::{prepare_get_request, Fetcher, PairPriceData, PriceFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct BinancePriceData {
    pub symbol: String,
    pub price: String,
}

type BinancePriceResponse = Vec<BinancePriceData>;

pub struct BinancePriceFetcher {
    // base_url: str,
    // params: Option<[(str, str)]>
}

impl PriceFetcher for BinancePriceFetcher {}

impl Fetcher for BinancePriceFetcher {
    type ApiResponse = BinancePriceResponse;
    const NAME: &str = "Binance";

    fn get_request(&self) -> Result<blocksense_sdk::spin::http::Request> {
        prepare_get_request("https://api.binance.com/api/v3/ticker/price", None)
    }

    fn parse_response(value: Self::ApiResponse) -> Result<Self::ParsedResponse> {
        Ok(value
            .into_iter()
            .map(|value| (value.symbol, value.price))
            .collect())
    }
}

trait Fetcher2 {
    type ApiResponse: DeserializeOwned;
    type FetchResult;

    fn get_url(&self) -> String;

    fn parse_http_response(response: Response) -> Result<Self::ApiResponse> {
        let body = response.body();
        serde_json::from_slice(body).map_err(Into::into)
    }

    fn process_api_response(response: Self::ApiResponse) -> Result<Self::FetchResult>;

    fn fetch<'a>(&self) -> LocalBoxFuture<'a, Result<Self::FetchResult>> {
        let url = self.get_url();
        Box::pin(async move {
            let request = prepare_get_request(&url, None)?;
            let response: Response = send(request).await?;

            let api_response = Self::parse_http_response(response)?;
            let result = Self::process_api_response(api_response)?;

            Ok(result)

            // init fetcher struct with required state
            // Prepare http request
            // parse response
            // transform response to the correct format
            //
            //
            // price fetcher
            //  gets a single symbol and returns its price
            //
            // prices fetcher
            //  gets a slice of symbols or all symbols and returns a hashmap<trading_pair, price>
            //
            //  depending on the exchange it can provide a bulk request or fall back to using price
            //  fetcher in a loop
        })
    }
}

pub struct BinancePriceFetcher2<'a> {
    symbols: Option<&'a [&'a str]>,
}

impl<'a> BinancePriceFetcher2<'a> {
    pub fn new(symbols: &'a [&'a str]) -> Self {
        Self {
            symbols: Some(symbols),
        }
    }
}

impl Fetcher2 for BinancePriceFetcher {
    type ApiResponse = BinancePriceResponse;

    type FetchResult = PairPriceData;

    fn get_url(&self) -> String {
        String::from("https://api.binance.com/api/v3/ticker/price")
    }

    fn process_api_response(response: Self::ApiResponse) -> Result<Self::FetchResult> {
        Ok(response
            .into_iter()
            .map(|value| (value.symbol, value.price))
            .collect())
    }
}
