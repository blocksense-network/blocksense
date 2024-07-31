use feed_registry::api::DataFeedAPI;

use super::data_feed::DataFeed;

pub trait ApiConnect {
    fn is_connected(&self) -> bool;

    fn api(&self) -> &DataFeedAPI;
}
