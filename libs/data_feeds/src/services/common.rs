use feed_registry::types::{FeedError, FeedResult};

pub fn fill_generic_feed_error_vec(service_name: &str, size: usize) -> Vec<FeedResult> {
    let generic_error = get_generic_feed_error(service_name);

    vec![Err(generic_error); size]
}

pub fn get_generic_feed_error(service_name: &str) -> FeedError {
    FeedError::APIError(format!("{} poll failed!", service_name))
}
