use crate::types::DataFeedAPI;

use super::data_feed::DataFeed;

pub trait ApiConnect {
    fn api_connect(&self) -> Box<dyn DataFeed>;

    fn is_connected(&self) -> bool;

    fn api(&self) -> &DataFeedAPI;
}
