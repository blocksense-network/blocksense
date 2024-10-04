use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fmt::{self, Display},
    time::{SystemTime, UNIX_EPOCH},
};
use thiserror::Error;
use tokio::sync::mpsc::UnboundedSender;
use tracing::debug;

use crypto::JsonSerializableSignature;
use num::BigUint;

use crate::aggregate::{get_aggregator, AverageAggregator, FeedAggregate};

#[derive(Debug, PartialEq, Copy, Clone)]
pub enum Repeatability {
    Periodic, // Has infinite number of voting slots
    Oneshot,  // Has only one voting slot
}

#[derive(Debug, PartialEq)]
pub enum ReportRelevance {
    Relevant,
    NonRelevantOld,
    NonRelevantInFuture,
}

pub enum FeedsSlotProcessorCmds {
    Terminate(),
}

#[derive(Debug)]
pub struct FeedMetaData {
    name: String,
    voting_repeatability: Repeatability,
    pub report_interval_ms: u64, // Consider oneshot feeds.
    quorum_percentage: f32,
    first_report_start_time: SystemTime,
    feed_aggregator: Box<dyn FeedAggregate>,
    pub value_type: String,
    pub aggregate_type: String,
    processor_cmd_chan: Option<UnboundedSender<FeedsSlotProcessorCmds>>,
}

impl FeedMetaData {
    pub fn new_oneshot(
        name: String,
        report_interval_ms: u64, // Consider oneshot feeds.
        quorum_percentage: f32,
        first_report_start_time: SystemTime,
    ) -> FeedMetaData {
        FeedMetaData {
            name,
            voting_repeatability: Repeatability::Oneshot,
            report_interval_ms,
            quorum_percentage,
            first_report_start_time,
            feed_aggregator: Box::new(AverageAggregator {}),
            value_type: "Numeric".to_string(),
            aggregate_type: "Average".to_string(),
            processor_cmd_chan: None,
        }
    }

    pub fn new(
        name: &str,
        report_interval_ms: u64, // Consider oneshot feeds.
        quorum_percentage: f32,
        first_report_start_time: SystemTime,
        value_type: String,
        aggregate_type: String,
        processor_cmd_chan: Option<UnboundedSender<FeedsSlotProcessorCmds>>,
    ) -> FeedMetaData {
        FeedMetaData {
            name: name.to_string(),
            voting_repeatability: Repeatability::Periodic,
            report_interval_ms,
            quorum_percentage,
            first_report_start_time,
            feed_aggregator: get_aggregator(aggregate_type.as_str()), //TODO(snikolov): This should be resolved based upon the ConsensusMetric enum sent from the reporter or directly based on the feed_id
            value_type,
            aggregate_type,
            processor_cmd_chan,
        }
    }

    pub fn set_processor_cmd_chan(&mut self, send_chan: UnboundedSender<FeedsSlotProcessorCmds>) {
        self.processor_cmd_chan = Some(send_chan);
    }

    pub fn get_name(&self) -> &String {
        &self.name
    }
    pub fn get_report_interval_ms(&self) -> u64 {
        self.report_interval_ms
    }
    pub fn get_quorum_percentage(&self) -> f32 {
        self.quorum_percentage
    }
    pub fn get_first_report_start_time_ms(&self) -> u128 {
        let since_the_epoch = self
            .first_report_start_time
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards");
        since_the_epoch.as_millis()
    }
    pub fn get_slot(&self, current_time_as_ms: u128) -> u64 {
        if self.voting_repeatability == Repeatability::Oneshot {
            // Oneshots only have the zero slot
            return 0;
        }
        ((current_time_as_ms - self.get_first_report_start_time_ms())
            / self.report_interval_ms as u128) as u64
    }
    pub fn get_feed_aggregator(&self) -> &dyn FeedAggregate {
        self.feed_aggregator.as_ref()
    }
    pub fn check_report_relevance(
        &self,
        current_time_as_ms: u128,
        msg_timestamp: u128,
    ) -> ReportRelevance {
        let start_of_voting_round = self.get_first_report_start_time_ms()
            + (self.get_slot(current_time_as_ms) as u128 * self.get_report_interval_ms() as u128);
        let end_of_voting_round = start_of_voting_round + self.get_report_interval_ms() as u128;

        if msg_timestamp < start_of_voting_round {
            debug!("Rejected report, time stamp is in a past slot.");
            return ReportRelevance::NonRelevantOld;
        }
        if msg_timestamp > end_of_voting_round {
            debug!("Rejected report, time stamp is in a future slot.");
            return ReportRelevance::NonRelevantInFuture;
        }
        debug!("Accepted report!");
        ReportRelevance::Relevant
    }

    // Return time to slot end. Can be negative for Oneshot feeds in the past.
    pub fn time_to_slot_end_ms(feed_meta_data: &FeedMetaData, timestamp_as_ms: u128) -> i128 {
        let start_of_voting_round = feed_meta_data.get_first_report_start_time_ms()
            + (feed_meta_data.get_slot(timestamp_as_ms) as u128
                * feed_meta_data.get_report_interval_ms() as u128);
        let end_of_voting_round =
            start_of_voting_round + feed_meta_data.get_report_interval_ms() as u128;
        end_of_voting_round as i128 - timestamp_as_ms as i128
    }

    // Return if this Feed is Oneshot.
    pub fn is_oneshot(&self) -> bool {
        self.voting_repeatability == Repeatability::Oneshot
    }
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub enum FeedType {
    Numerical(f64),
    Text(String),
}

//TODO: In the future, consider support for variable precision
const MAX_DIGITS_IN_FRACTION: usize = 18;

impl FeedType {
    pub fn sizeof(&self) -> usize {
        match self {
            FeedType::Numerical(_) => std::mem::size_of::<f64>(),
            FeedType::Text(s) => s.len(),
        }
    }

    pub fn as_bytes(&self) -> Vec<u8> {
        match self {
            FeedType::Numerical(val) => {
                let truncate =
                    |s: String, max_width: usize| -> String { s.chars().take(max_width).collect() };

                let str_val = val.to_string();
                let val_split: Vec<&str> = str_val.split('.').collect();

                let integer = val_split[0].parse::<BigUint>().unwrap();

                let actual_digits_in_fraction: usize;
                let fraction: BigUint;

                if val_split.len() > 1 {
                    actual_digits_in_fraction =
                        truncate(val_split[1].to_string(), MAX_DIGITS_IN_FRACTION).len();

                    fraction = truncate(val_split[1].to_string(), MAX_DIGITS_IN_FRACTION)
                        .parse::<BigUint>()
                        .unwrap();
                } else {
                    actual_digits_in_fraction = 0;
                    fraction = BigUint::from(0u32);
                }

                let result = (integer * BigUint::from(10u32).pow(MAX_DIGITS_IN_FRACTION as u32))
                    + (fraction
                        * BigUint::from(10u32)
                            .pow(MAX_DIGITS_IN_FRACTION as u32 - actual_digits_in_fraction as u32));

                let mut value_bytes = result.to_bytes_be();
                let mut bytes_vec = vec![0; 32 - value_bytes.len()];
                bytes_vec.append(&mut value_bytes);

                bytes_vec.drain(..8);
                bytes_vec.extend(vec![0; 8]);

                bytes_vec
            }
            FeedType::Text(s) => s.as_bytes().to_vec(),
        }
    }

    pub fn parse_to_string(&self) -> String {
        match self {
            FeedType::Numerical(val) => format!("{}", val),
            FeedType::Text(s) => s.clone(),
        }
    }

    pub fn from_bytes(bytes: Vec<u8>, variant: FeedType) -> Result<FeedType, String> {
        match variant {
            FeedType::Numerical(_) => {
                if bytes.len() < 32 {
                    return Err("Bytes len less than required!".to_string());
                }

                let mut bytes_mut = bytes;
                bytes_mut.truncate(24);

                let mut result = vec![0_u8; 8];
                result.append(&mut bytes_mut);

                let combined = BigUint::from_bytes_be(&result);

                let fraction = &combined % BigUint::from(10u32).pow(MAX_DIGITS_IN_FRACTION as u32);
                let integer = &combined / BigUint::from(10u32).pow(MAX_DIGITS_IN_FRACTION as u32);

                let str_val = format!("{}.{:0>18}", integer, fraction.to_string());

                let val = match str_val.parse::<f64>() {
                    Ok(v) => v,
                    Err(e) => return Err(format!("Bytes cannot be parsed as f64: {}", e)),
                };

                Ok(FeedType::Numerical(val))
            }
            FeedType::Text(_) => {
                let s =
                    String::from_utf8(bytes).map_err(|_| "Invalid UTF-8 sequence".to_string())?;
                Ok(FeedType::Text(s))
            }
        }
    }
}

pub type Timestamp = u128;

#[derive(Debug)]
pub struct Asset {
    pub resources: HashMap<String, String>,
    pub feed_id: u32,
}

#[derive(Debug, Serialize)]
pub struct Bytes32(pub [u8; 32]);

impl Display for Bytes32 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self.0)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct DataFeedPayload {
    /// Data feed metadata
    pub payload_metadata: PayloadMetaData,

    /// Data feed result
    pub result: FeedResult,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(untagged)]
pub enum FeedResult {
    Result { result: FeedType },
    Error { error: FeedError },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PayloadMetaData {
    /// reported id
    pub reporter_id: u64,
    /// data feed id
    pub feed_id: String,
    /// timestamp from when the data feed was gathered
    pub timestamp: Timestamp,
    /// signature of feed_id + timestamp + result
    pub signature: JsonSerializableSignature,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PostRegisterOracle {
    #[serde(default)]
    pub name: u64,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub data_feeds: Vec<DataFeed>,
    #[serde(default)]
    pub oracle_script_wasm: String,
}

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
pub enum FeedError {
    #[error("API error ocurred: {0}")]
    APIError(String),

    #[error("Undefined error ocurred")]
    UndefinedError,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct DataFeed {
    #[serde(default)]
    pub name: u64,
    #[serde(default)]
    pub namespace: u64,
}
