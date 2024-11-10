use std::collections::HashMap;

use async_trait::async_trait;
use feed_registry::types::{Asset, FeedResult, Timestamp};

#[derive(Debug, Clone, Copy)]
pub enum Policy {
    Fallback,
    AverageAggregator,
}

#[derive(Debug)]
pub enum APIError {
    ApiError(String),
    ConnectionError,
    TimeoutError,
}

#[async_trait]
pub trait APIInterface {
    type Output;
    type Error;

    async fn poll(&mut self, asset: &str) -> Result<Option<Self::Output>, Self::Error>;

    async fn poll_batch(
        &mut self,
        assets: &[Asset],
    ) -> Result<HashMap<Asset, FeedResult>, anyhow::Error>;
}

pub struct APIEngine<T: APIInterface> {
    apis: Vec<T>,
    policy: Policy,
}

impl<T: APIInterface> APIEngine<T> {
    pub fn new(apis: Vec<T>, policy: Policy) -> Self {
        APIEngine { apis, policy }
    }

    // Add a new API interface to the engine
    pub fn add_api(&mut self, api: T) {
        self.apis.push(api);
    }

    // Main polling method that implements different policies
    pub async fn poll_batch(&mut self, assets: &[Asset]) -> HashMap<Asset, FeedResult> {
        match self.policy {
            Policy::Fallback => self.poll_batch_fallback(assets).await,
            Policy::AverageAggregator => unimplemented!(),
        }
    }

    pub async fn poll(&mut self, asset: Asset) -> Result<Option<T::Output>, T::Error> {
        match self.policy {
            Policy::Fallback => self.poll_fallback(asset).await,
            Policy::AverageAggregator => unimplemented!(),
        }
    }

    async fn poll_batch_fallback(&mut self, assets: &[Asset]) -> HashMap<Asset, FeedResult> {
        let mut results_map: HashMap<u32, FeedResult> = HashMap::new();
        let mut remaining_assets = assets.to_vec();

        for api in &mut self.apis {
            if remaining_assets.is_empty() {
                break;
            }

            match api.poll_batch(&remaining_assets).await {
                Ok(api_results) => {
                    // Get valid FeedType results from this API
                    for (asset, result) in api_results {
                        if let FeedResult::Result { result: _ } = result {
                            results_map.insert(asset.feed_id, result);
                        }
                    }

                    // Update remaining assets - remove ones that got valid FeedType results
                    remaining_assets.retain(|asset| {
                        !results_map.contains_key(&asset.feed_id)
                            || matches!(
                                results_map.get(&asset.feed_id),
                                Some(FeedResult::Error { .. })
                            )
                    });
                }
                Err(_) => {
                    continue;
                }
            }
        }

        assets
            .iter()
            .filter_map(|asset| {
                results_map
                    .get(&asset.feed_id)
                    .cloned()
                    .map(|result| (asset.clone(), result))
            })
            .collect()
    }

    async fn poll_fallback(&self, asset: Asset) -> Result<Option<T::Output>, T::Error> {
        unimplemented!();
    }
}
