pub trait FeedProcessing: Send + Sync {
    fn process(&self, values: Vec<&String>) -> String;
}
