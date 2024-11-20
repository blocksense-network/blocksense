use std::{collections::HashMap, time::Duration};

use async_trait::async_trait;
use feed_registry::types::{Asset, FeedError, FeedResult, FeedType};
use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::api::api_engine::{APIError, APIInterface};

const KRAKEN_API_URL: &str = "https://api.kraken.com/0/public/Ticker";
const TIMEOUT_DURATION: u64 = 2; // 2 seconds timeout

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KrakenResponse {
    pub error: Vec<String>,
    pub result: HashMap<String, KrakenAsset>,
}

#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KrakenAsset {
    #[serde(rename = "askPrice")]
    pub a: Vec<String>,
    #[serde(rename = "bidPrice")]
    pub b: Vec<String>,
    #[serde(rename = "lastClosePrice")]
    pub c: Vec<String>,
    #[serde(rename = "volume")]
    pub v: Vec<String>,
    #[serde(rename = "averagePrice")]
    pub p: Vec<String>,
    #[serde(rename = "tradesCount")]
    pub t: Vec<i64>,
    #[serde(rename = "lowPrice")]
    pub l: Vec<String>,
    #[serde(rename = "highPrice")]
    pub h: Vec<String>,
    #[serde(rename = "openPrice")]
    pub o: String,
}
pub struct KrakenAPI {
    client: Client,
}

impl KrakenAPI {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(TIMEOUT_DURATION))
            .build()
            .unwrap_or_default();

        KrakenAPI { client }
    }

    fn parse_price(price_str: String) -> Result<f64, APIError> {
        price_str
            .parse::<f64>()
            .map_err(|e| APIError::ApiError(format!("Failed to parse price: {}", e)))
    }
}

#[async_trait]
impl APIInterface for KrakenAPI {
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
            .get(KRAKEN_API_URL)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Connection error: {}", e))?;

        //TODO:(snikolov): Fill a Hashmap with error values
        if !response.status().is_success() {
            return Err(anyhow::anyhow!("API request failed"));
        }

        let kraken_response: KrakenResponse = response
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse response: {}", e))?;

        if !kraken_response.error.is_empty() {
            return Err(anyhow::anyhow!(
                "API error: {}",
                kraken_response.error.join(", ")
            ));
        }

        let mut results = HashMap::new();

        for asset in assets {
            let kraken_symbol = asset.resources.get("kraken_ticker").unwrap();
            if let Some(asset_data) = kraken_response.result.keys().find(|p| {
                asset
                    .resources
                    .get(kraken_symbol)
                    .map_or(false, |ticker| **p == *ticker)
            }) {
                match Self::parse_price(
                    kraken_response.result.get(asset_data).unwrap().c[2].clone(),
                ) {
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
            }
        }

        Ok(results)
    }
}
