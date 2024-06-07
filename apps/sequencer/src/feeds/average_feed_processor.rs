use crate::feeds::feeds_processing::FeedProcessing;
use crate::feeds::feeds_processing::REPORT_HEX_SIZE;
use crate::utils::byte_utils::to_hex_string;
use tracing::{debug, info_span};

#[derive(Debug)]
pub struct AverageFeedProcessor {}

impl AverageFeedProcessor {
    pub fn new() -> AverageFeedProcessor {
        AverageFeedProcessor {}
    }
}
use alloy::hex;
impl FeedProcessing for AverageFeedProcessor {
    fn process(&self, values: Vec<&String>) -> String {
        let span = info_span!("AverageFeedProcessor::process");
        let _guard = span.enter();
        let num_elements = values.len() as f64;
        for v in &values {
            debug!("{}", v);
        }
        let total: f64 = values
            .into_iter()
            .map(|v| f64::from_be_bytes(hex::decode(v).unwrap()[0..8].try_into().unwrap()))
            .sum();
        let result: f64 = total / num_elements;

        to_hex_string(result.to_be_bytes().to_vec(), Some(REPORT_HEX_SIZE / 2))
    }
}

use core::fmt::Debug;
impl Debug for dyn FeedProcessing {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "FeedProcessing")
    }
}
