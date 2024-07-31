use async_trait::async_trait;

use feed_registry::{
    aggregate::ConsensusMetric,
    types::{FeedResult, Timestamp},
};

use super::{api_connect::ApiConnect, historical::Historical};

#[async_trait(?Send)]
pub trait DataFeed: ApiConnect + Historical {
    fn score_by(&self) -> ConsensusMetric;

    async fn poll(&mut self, asset: &str) -> (FeedResult, Timestamp);

    //TODO: Implement abstraction for publishing

    // async fn publish(destination: String, payload: Box<dyn Payload>) -> Result<(),anyhow::Error>;

    // fn host_connect(&self);
}
