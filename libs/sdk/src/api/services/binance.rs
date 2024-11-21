use std::collections::HashMap;
use std::time::Duration;

use async_trait::async_trait;
use feed_registry::types::Asset;
use feed_registry::types::FeedError;
use feed_registry::types::FeedResult;
use feed_registry::types::FeedType;
use reqwest::Client;
use serde_derive::{Deserialize, Serialize};

use crate::api::api_engine::APIError;
use crate::api::api_engine::APIInterface;

const BINANCE_API_URL: &str = "https://api.binance.com/api/v3/ticker/price";
const TIMEOUT_DURATION: u64 = 2; // 2 seconds timeout
const ERROR_STRING: &str = "Binance API Error";

pub type BinanceResponse = Vec<BinanceAsset>;

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinanceAsset {
    pub symbol: String,
    pub price: String,
}

pub struct BinanceAPI {
    client: Client,
}

impl BinanceAPI {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(TIMEOUT_DURATION))
            .build()
            .unwrap_or_default();

        BinanceAPI { client }
    }

    fn parse_price(price_str: &str) -> Result<f64, APIError> {
        price_str
            .parse::<f64>()
            .map_err(|e| APIError::ApiError(format!("Failed to parse price: {}", e)))
    }
}

#[async_trait]
impl APIInterface for BinanceAPI {
    type Output = f64;
    type Error = APIError;

    async fn poll(&mut self, asset: &str) -> Result<Option<Self::Output>, Self::Error> {
        unimplemented!();
    }

    async fn poll_batch(
        &mut self,
        assets: &[Asset],
    ) -> Result<HashMap<Asset, FeedResult>, anyhow::Error> {
        let response = self
            .client
            .get(BINANCE_API_URL)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Connection error: {}", e))?;

        //TODO:(snikolov): Fill a Hashmap with error values
        if !response.status().is_success() {
            return Err(anyhow::anyhow!("API request failed"));
        }

        let binance_response: BinanceResponse = response
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse response: {}", e))?;

        let mut results = HashMap::new();

        for asset in assets {
            if let Some(price_data) = binance_response.iter().find(|p| {
                asset
                    .resources
                    .get("binance_ticker")
                    .map_or(false, |ticker| p.symbol == *ticker)
            }) {
                match Self::parse_price(&price_data.price) {
                    Ok(price) => {
                        results.insert(
                            asset.clone(),
                            FeedResult::Result {
                                result: FeedType::Numerical(price),
                            },
                        );
                    }
                    Err(e) => {
                        results.insert(
                            asset.clone(),
                            FeedResult::Error {
                                error: FeedError::APIError(format!("{:?}", e)),
                            },
                        );
                    }
                }
            } else {
                results.insert(
                    asset.clone(),
                    FeedResult::Error {
                        error: FeedError::APIError(ERROR_STRING.to_string()),
                    },
                );
            }
        }

        Ok(results)
    }
}
