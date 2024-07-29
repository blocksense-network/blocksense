use crate::types::FeedType;

pub trait FeedAggregate: Send + Sync {
    fn aggregate(&self, values: Vec<&FeedType>) -> FeedType;
}
