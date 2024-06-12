use async_trait::async_trait;

use crate::{
    connector::error::FeedError,
    types::{ConsensusMetric, Timestamp},
};

use super::{api_connect::ApiConnect, historical::Historical, payload::Payload};

#[async_trait(?Send)]
pub trait DataFeed: ApiConnect + Historical {
    fn score_by(&self) -> ConsensusMetric;

    async fn poll(&mut self, asset: &str) -> (Result<Box<dyn Payload>, FeedError>, Timestamp);

    //TODO: Implement abstraction for publishing

    // async fn publish(destination: String, payload: Box<dyn Payload>) -> Result<(),anyhow::Error>;

    // fn host_connect(&self);
}
