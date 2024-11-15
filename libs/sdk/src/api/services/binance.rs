use std::collections::HashMap;
use std::time::Duration;

use async_trait::async_trait;
use feed_registry::types::Asset;
use feed_registry::types::FeedResult;
use reqwest::blocking::Client;
use serde_derive::{Deserialize, Serialize};

use crate::api::api_engine::APIError;
use crate::api::api_engine::APIInterface;

const BINANCE_API_URL: &str = "https://api.binance.com/api/v3/ticker/price";
const TIMEOUT_DURATION: u64 = 2; // 2 seconds timeout

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

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("API request failed"));
        }

        let binance_reposnse: BinanceResponse = response
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse response: {}", e))?;

        let mut results = HashMap::new();

        for asset in assets {
            if let Some(price_data) = binance_reposnse
                .iter()
                .find(|p| p.symbol == asset.resources.get("binance_ticker"))
            {
                match Self::parse_price(&price_data.price) {
                    Ok(price) => {
                        results.insert(asset.clone(), FeedResult::Result { result: price });
                    }
                    Err(e) => {
                        results.insert(
                            asset.clone(),
                            FeedResult::Error {
                                error: format!("Price parsing error: {}", e),
                            },
                        );
                    }
                }
            }
        }

        Ok(results)
    }
}
