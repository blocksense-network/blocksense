pub const REPORT_HEX_SIZE: usize = 64;
pub trait FeedProcessing: Send + Sync {
    fn process(&self, values: Vec<&String>) -> String;
}
