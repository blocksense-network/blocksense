use anyhow::bail;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fmt::{self, Display},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use thiserror::Error;
use tokio::sync::mpsc::UnboundedSender;
use tracing::debug;

use crate::aggregate::FeedAggregate;
use blocksense_crypto::{JsonSerializableSignature, Signature};
use blocksense_registry::config::FeedConfig;
use num::BigUint;

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
    pub quorum_percentage: f32,
    pub skip_publish_if_less_then_percentage: f32,
    pub always_publish_heartbeat_ms: Option<u128>,
    first_report_start_time: SystemTime,
    feed_aggregator: FeedAggregate,
    pub value_type: String,
    pub aggregate_type: String,
    pub processor_cmd_chan: Option<UnboundedSender<FeedsSlotProcessorCmds>>,
}

impl FeedMetaData {
    pub fn new_oneshot(
        name: String,
        report_interval_ms: u64, // Consider oneshot feeds.
        quorum_percentage: f32,
        first_report_start_time: SystemTime,
    ) -> FeedMetaData {
        let skip_publish_if_less_then_percentage = 0.0f32;
        let always_publish_heartbeat_ms = None;
        FeedMetaData {
            name,
            voting_repeatability: Repeatability::Oneshot,
            report_interval_ms,
            quorum_percentage,
            skip_publish_if_less_then_percentage,
            always_publish_heartbeat_ms,
            first_report_start_time,
            feed_aggregator: FeedAggregate::MajorityVoteAggregator,
            value_type: "text".to_string(),
            aggregate_type: "average".to_string(),
            processor_cmd_chan: None,
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn new(
        name: String,
        report_interval_ms: u64, // Consider oneshot feeds.
        quorum_percentage: f32,
        skip_publish_if_less_then_percentage: f32,
        always_publish_heartbeat_ms: Option<u128>,
        first_report_start_time: SystemTime,
        value_type: String,
        aggregate_type: String,
        processor_cmd_chan: Option<UnboundedSender<FeedsSlotProcessorCmds>>,
    ) -> FeedMetaData {
        FeedMetaData {
            name,
            voting_repeatability: Repeatability::Periodic,
            report_interval_ms,
            quorum_percentage,
            skip_publish_if_less_then_percentage,
            always_publish_heartbeat_ms,
            first_report_start_time,
            feed_aggregator: FeedAggregate::create_from_str(aggregate_type.as_str())
                .expect("Could not convert {aggregate_type} to a valid aggregator!"), //TODO(snikolov): This should be resolved based upon the ConsensusMetric enum sent from the reporter or directly based on the feed_id
            value_type,
            aggregate_type,
            processor_cmd_chan,
        }
    }

    pub fn from_config(cfg: &FeedConfig) -> Self {
        Self::new(
            cfg.full_name.clone(),
            cfg.schedule.interval_ms,
            cfg.quorum.percentage,
            cfg.schedule.deviation_percentage,
            cfg.schedule.heartbeat_ms,
            UNIX_EPOCH + Duration::from_millis(cfg.schedule.first_report_start_unix_time_ms),
            cfg.value_type.clone(),
            cfg.quorum.aggregation.clone(),
            None,
        )
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
    pub fn get_skip_publish_if_less_then_percentage(&self) -> f32 {
        self.skip_publish_if_less_then_percentage
    }
    pub fn get_always_publish_heartbeat_ms(&self) -> Option<u128> {
        self.always_publish_heartbeat_ms
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
    pub fn get_feed_aggregator(&self) -> FeedAggregate {
        self.feed_aggregator
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
    Bytes(Vec<u8>),
}

impl FeedType {
    pub fn sizeof(&self) -> usize {
        match self {
            FeedType::Numerical(_) => std::mem::size_of::<f64>(),
            FeedType::Bytes(v) => v.len(),
            FeedType::Text(s) => s.len(),
        }
    }

    pub fn as_bytes(&self, digits_in_fraction: usize, timestamp: u64) -> anyhow::Result<Vec<u8>> {
        match self {
            FeedType::Numerical(val) => {
                let truncate =
                    |s: String, max_width: usize| -> String { s.chars().take(max_width).collect() };

                let str_val = val.to_string();
                let val_split: Vec<&str> = str_val.split('.').collect();

                // BUG: A crash happened on the reporter side. Our guess is that the value was
                // some of the special values of the floating point standard (IEEE 754).
                // Left these logs in order to diagnose it later.
                let integer = match val_split[0].parse::<BigUint>() {
                    Ok(v) => v,
                    Err(err) => {
                        bail!("FeedType::as_bytes error: {err:?}. Value was {val}. Formatted like {str_val:?}");
                    }
                };

                let actual_digits_in_fraction: usize;
                let fraction: BigUint;

                if val_split.len() > 1 {
                    actual_digits_in_fraction =
                        truncate(val_split[1].to_string(), digits_in_fraction).len();

                    fraction = truncate(val_split[1].to_string(), digits_in_fraction)
                        .parse::<BigUint>()
                        .unwrap();
                } else {
                    actual_digits_in_fraction = 0;
                    fraction = BigUint::from(0u32);
                }

                let result = (integer * BigUint::from(10u32).pow(digits_in_fraction as u32))
                    + (fraction
                        * BigUint::from(10u32)
                            .pow(digits_in_fraction as u32 - actual_digits_in_fraction as u32));

                let mut value_bytes = result.to_bytes_be();
                let mut bytes_vec = vec![0; 32 - value_bytes.len()];
                bytes_vec.append(&mut value_bytes);

                bytes_vec.drain(..8);
                bytes_vec.extend(timestamp.to_be_bytes());

                Ok(bytes_vec)
            }
            FeedType::Text(s) => Ok(s.as_bytes().to_vec()),
            FeedType::Bytes(bytes) => Ok(bytes.clone()),
        }
    }

    pub fn parse_to_string(&self) -> String {
        match self {
            FeedType::Numerical(val) => format!("{}", val),
            FeedType::Text(s) => s.clone(),
            FeedType::Bytes(bytes) => format!("{:?}", bytes),
        }
    }

    pub fn from_bytes(
        bytes: Vec<u8>,
        variant: FeedType,
        digits_in_fraction: usize,
    ) -> Result<FeedType, String> {
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

                let fraction = &combined % BigUint::from(10u32).pow(digits_in_fraction as u32);
                let integer = &combined / BigUint::from(10u32).pow(digits_in_fraction as u32);

                let str_val = format!("{}.{:0>digits_in_fraction$}", integer, fraction.to_string());

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
            FeedType::Bytes(_) => Ok(FeedType::Bytes(bytes)),
        }
    }

    pub fn enum_type_to_string(&self) -> &str {
        match self {
            FeedType::Numerical(_) => "FeedType::Numerical",
            FeedType::Text(_) => "FeedType::Text",
            FeedType::Bytes(_) => "FeedType::Bytes",
        }
    }

    pub fn get_variant_from_string(feed_type: &str) -> Result<FeedType, String> {
        let feed_type = match feed_type {
            "numerical" => FeedType::Numerical(0.0f64),
            "text" => FeedType::Text("".to_string()),
            "bytes" => FeedType::Bytes(vec![]),
            _ => {
                return Err(format!("Unsupported feed type {feed_type}"));
            }
        };
        Ok(feed_type)
    }

    pub fn same_enum_type_as(&self, other: &FeedType) -> bool {
        std::mem::discriminant(self) == std::mem::discriminant(other)
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

pub fn test_payload_from_result(result: FeedResult) -> DataFeedPayload {
    DataFeedPayload {
        payload_metadata: PayloadMetaData {
            reporter_id: 0,
            feed_id: 0.to_string(),
            timestamp: 0,
            signature: JsonSerializableSignature {
                sig: Signature::deserialize(&[
                    0, 75, 165, 94, 34, 91, 193, 86, 52, 0, 106, 177, 27, 82, 185, 18, 70, 254,
                    112, 46, 89, 145, 219, 189, 112, 201, 83, 200, 117, 8, 151, 81, 111, 118, 67,
                    40, 96, 97, 112, 146, 70, 82, 119, 13, 137, 75, 166, 90, 20, 139, 229, 212,
                    109, 59, 233, 200, 57, 36, 128, 239, 247, 108, 175, 240, 26, 36, 203, 72, 61,
                    5, 156, 77, 203, 185, 61, 203, 174, 34, 226, 165, 225, 192, 231, 186, 37, 167,
                    159, 49, 183, 201, 111, 11, 121, 134, 149, 18, 2, 187, 19, 32, 9, 0, 200, 146,
                    216, 237, 154, 150, 149, 81, 230, 98, 142, 93, 85, 239, 65, 92, 6, 110, 174,
                    139, 226, 57, 50, 165, 15, 108, 37, 16, 196, 29, 25, 9, 193, 162, 201, 62, 99,
                    173, 148, 2, 50, 158, 2, 100, 76, 25, 218, 70, 166, 215, 155, 160, 162, 46,
                    101, 233, 175, 104, 0, 7, 20, 235, 100, 163, 35, 76, 63, 34, 32, 32, 154, 81,
                    174, 5, 110, 5, 195, 12, 128, 68, 244, 46, 214, 92, 85, 53, 71, 50, 12, 117,
                ])
                .expect("Signature::deserialize failed!"),
            },
        },
        result,
    }
}

pub type FeedResult = Result<FeedType, FeedError>;

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
pub struct GetLastPublishedRequestData {
    /// data feed id
    pub feed_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LastPublishedValue {
    /// data feed id
    pub feed_id: String,
    /// last published value
    pub value: Option<FeedType>,
    /// when the timeslot ended and the value is published
    pub timeslot_end: Timestamp,
    /// option to pass error as string
    pub error: Option<String>,
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

#[derive(PartialEq, Debug, Error, Clone, Serialize, Deserialize)]
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
