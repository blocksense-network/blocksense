use async_trait::async_trait;
use feed_registry::{
    aggregate::ConsensusMetric,
    types::{FeedResult, Timestamp},
};

use super::{api_connect::ApiConnect, historical::Historical};

pub struct Asset {
    pub name: String,
    pub id: u32,
}

#[async_trait]
pub trait DataFeed: ApiConnect + Historical {
    fn score_by(&self) -> ConsensusMetric;

    fn poll(&mut self, asset: &str) -> (FeedResult, Timestamp);

    async fn poll_batch(&mut self, assets: &[Asset]) -> Vec<(FeedResult, u32, Timestamp)>;
}
