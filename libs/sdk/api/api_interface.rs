use async_trait::async_trait;

#[async_trait]
pub trait APIInterface {

    async fn poll(&mut self, asset: &str) -> (FeedResult, Timestamp);

    async fn poll_batch(&mut self, assets: &[Asset]) -> Vec<(FeedResult, u32, Timestamp)>;
}
