use feed_registry::{
    aggregate::ConsensusMetric,
    types::{FeedResult, Timestamp},
};

use super::{api_connect::ApiConnect, historical::Historical};

pub trait DataFeed: ApiConnect + Historical {
    fn score_by(&self) -> ConsensusMetric;

    fn poll(&mut self, asset: &str) -> (FeedResult, Timestamp);

    fn poll_batch(&mut self, assets: &Vec<(String, u32)>) -> Vec<(FeedResult, u32, Timestamp)>;
}
