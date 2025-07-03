use anyhow::{Error, Result};
use futures::{future::LocalBoxFuture, FutureExt};

use serde::Deserialize;

use blocksense_sdk::http::http_get_json;

use crate::price_data::fetchers::stock_markets::utils::print_missing_network_price_data;
use crate::price_data::traits::prices_fetcher::{PairPriceData, PricePoint, PricesFetcher};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceData {
    pub symbol: String,
    pub price: Option<f64>,
    pub volume: Option<f64>,
    pub previous_close: Option<f64>,
}

type FMPResponse = Vec<PriceData>;

pub struct FMPPriceFetcher<'a> {
    pub symbols: &'a [String],
    api_key: Option<&'a str>,
}

impl<'a> PricesFetcher<'a> for FMPPriceFetcher<'a> {
    const NAME: &'static str = "FMP";

    fn new(symbols: &'a [String], api_key: Option<&'a str>) -> Self {
        Self { symbols, api_key }
    }

    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>> {
        async {
            let api_key = match self.api_key {
                Some(key) => key,
                None => {
                    return Err(Error::msg("API key is required for FMP"));
                }
            };

            let all_symbols = self.symbols.join(",");

            let response = http_get_json::<FMPResponse>(
                format!("https://financialmodelingprep.com/api/v3/quote/{all_symbols}").as_str(),
                Some(&[("apikey", api_key)]),
                None,
            )
            .await?;

            let results = response
                .into_iter()
                .filter_map(|value| {
                    let price = value.price.or(value.previous_close);
                    let volume = value.volume;

                    match (price, volume) {
                        (Some(price), Some(volume)) => {
                            Some((value.symbol, PricePoint { price, volume }))
                        }
                        _ => {
                            print_missing_network_price_data("FMP", value.symbol, price, volume);
                            None
                        }
                    }
                })
                .collect::<PairPriceData>();
            Ok(results)
        }
        .boxed_local()
    }
}
