use crate::api::api_engine::APIError;
use crate::api::api_engine::APIInterface;
use async_trait::async_trait;
use feed_registry::types::Asset;
use feed_registry::types::FeedError;
use feed_registry::types::FeedResult;
use feed_registry::types::FeedType;
use reqwest::Client;
use serde_derive::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

const BYBIT_API_URL: &str = "https://api.bybit.com/v5/market/tickers";
const TIMEOUT_DURATION: u64 = 2; // 2 seconds timeout
const ERROR_STRING: &str = "ByBit API Error";

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ByBitResponse {
    pub ret_code: i64,
    pub ret_msg: String,
    pub result: bybitResult,
    pub ret_ext_info: RetExtInfo,
    pub time: i64,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetExtInfo {}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct bybitResult {
    pub category: String,
    pub list: Vec<List>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct List {
    pub symbol: String,
    pub last_price: String,
}

pub struct ByBitAPI {
    client: Client,
}

impl ByBitAPI {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(TIMEOUT_DURATION))
            .build()
            .unwrap_or_default();
        ByBitAPI { client }
    }

    fn parse_price(price_str: &str) -> Result<f64, APIError> {
        price_str
            .parse::<f64>()
            .map_err(|e| APIError::ApiError(format!("Failed to parse price: {}", e)))
    }
}

#[async_trait]
impl APIInterface for ByBitAPI {
    type Output = f64;
    type Error = APIError;

    async fn poll(&mut self, _asset: &str) -> Result<Option<Self::Output>, Self::Error> {
        unimplemented!();
    }

    async fn poll_batch(
        &mut self,
        assets: &[Asset],
    ) -> Result<HashMap<Asset, FeedResult>, anyhow::Error> {
        let url = format!("{}?category=spot", BYBIT_API_URL);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Connection error: {}", e))?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("API request failed"));
        }

        let bybit_response: ByBitResponse = response
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse response: {}", e))?;

        let mut results = HashMap::new();
        for asset in assets {
            if let Some(price_data) = bybit_response.result.list.iter().find(|p| {
                asset
                    .resources
                    .get("bybit_ticker")
                    .map_or(false, |ticker| p.symbol == *ticker)
            }) {
                match Self::parse_price(&price_data.last_price) {
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
