use async_trait::async_trait;
use feed_registry::{
    aggregate::ConsensusMetric,
    types::{Asset, FeedResult, Timestamp},
};

use super::{api_connect::ApiConnect, historical::Historical};

#[async_trait]
pub trait DataFeed: ApiConnect + Historical {
    fn score_by(&self) -> ConsensusMetric;

    fn poll(&mut self, asset: &str) -> (FeedResult, Timestamp);

    async fn poll_batch(&mut self, assets: &[Asset]) -> Vec<(FeedResult, u32, Timestamp)>;
}
