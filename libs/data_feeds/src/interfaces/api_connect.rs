use feed_registry::api::DataFeedAPI;

pub trait ApiConnect {
    fn is_connected(&self) -> bool;

    fn api(&self) -> &DataFeedAPI;
}
