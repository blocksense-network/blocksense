use anyhow::anyhow;
use blocksense_config::PublishCriteria;
use blocksense_feed_registry::{
    registry::FeedAggregateHistory,
    types::{DataFeedPayload, FeedType, Timestamp},
};
use blocksense_utils::{from_hex_string, EncodedFeedId, FeedId, Stride};
use log::error;
use serde::Deserialize;
use serde::Serialize;
use std::cmp::Ordering;
use tracing::debug;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VotedFeedUpdate {
    pub encoded_feed_id: EncodedFeedId,
    pub value: FeedType,
    pub end_slot_timestamp: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncodedVotedFeedUpdate {
    pub encoded_feed_id: EncodedFeedId,
    pub value: Vec<u8>,
    pub end_slot_timestamp: Timestamp,
}

#[derive(Debug, Clone)]
pub struct VotedFeedUpdateWithProof {
    pub update: VotedFeedUpdate,
    pub proof: Vec<DataFeedPayload>,
}

// Implement Eq and PartialEq
impl PartialEq for VotedFeedUpdateWithProof {
    fn eq(&self, other: &Self) -> bool {
        self.update.encoded_feed_id == other.update.encoded_feed_id
    }
}

impl Eq for VotedFeedUpdateWithProof {}

// Implement Ord and PartialOrd
impl PartialOrd for VotedFeedUpdateWithProof {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.update.encoded_feed_id.cmp(&other.update.encoded_feed_id))
    }
}

impl Ord for VotedFeedUpdateWithProof {
    fn cmp(&self, other: &Self) -> Ordering {
        self.update.encoded_feed_id.cmp(&other.update.encoded_feed_id)
    }
}

#[derive(Debug, PartialEq)]
pub enum DontSkipReason {
    ThresholdCrossed,
    HeartbeatTimedOut,
    NoHistory,
    NonNumericalFeed,
    OneShotFeed,
    HistoryError,
}

#[derive(Debug, PartialEq)]
pub enum DoSkipReason {
    TooSimilarTooSoon, // threshold not crossed and heartbeat not timed out
    NothingToPost,
}

#[derive(Debug, PartialEq)]
pub enum SkipDecision {
    DontSkip(DontSkipReason),
    DoSkip(DoSkipReason),
}

impl SkipDecision {
    pub fn get_value(&self) -> bool {
        match *self {
            SkipDecision::DontSkip(_) => false,
            SkipDecision::DoSkip(_) => true,
        }
    }
}

impl VotedFeedUpdate {
    pub fn encode(
        &self,
        digits_in_fraction: usize,
        timestamp: u64,
        legacy: bool,
    ) -> anyhow::Result<(Vec<u8>, Vec<u8>)> {
        Ok((
            {
                if legacy {
                    if self.encoded_feed_id.get_id() > u32::MAX as u128 {
                        anyhow::bail!(
                            "Error converting feed id {} to bytes for legacy contract - feed id does not fit in 4 bytes!",
                            self.encoded_feed_id,
                        )
                    }
                    (self.encoded_feed_id.get_id() as u32).to_be_bytes().to_vec()
                } else {
                    self.encoded_feed_id.get_id().to_be_bytes().to_vec()
                }
            },
            {
                match naive_packing(&self.value, digits_in_fraction, timestamp) {
                    Ok(bytes) => bytes,
                    Err(e) => {
                        anyhow::bail!(
                            "Error converting value for feed id {} to bytes {}",
                            self.encoded_feed_id,
                            e
                        )
                    }
                }
            },
        ))
    }

    pub fn new_decode(
        key: &str,
        stride: Stride,
        value: &str,
        end_slot_timestamp: Timestamp,
        variant: FeedType, // variant is only a type placeholder.
        digits_in_fraction: usize,
    ) -> Result<VotedFeedUpdate, anyhow::Error> {
        let key_bytes = from_hex_string(key)?;
        let mut dst = [0u8; std::mem::size_of::<FeedId>()];
        dst.clone_from_slice(&key_bytes[0..std::mem::size_of::<FeedId>()]);
        let feed_id = FeedId::from_be_bytes(dst);
        let value_bytes = from_hex_string(value)?;
        let value = FeedType::from_bytes(value_bytes, variant, digits_in_fraction)
            .map_err(|e| anyhow!("{e}"))?;

        let encoded_feed_id = EncodedFeedId::new(feed_id, stride);

        Ok(VotedFeedUpdate {
            encoded_feed_id,
            value,
            end_slot_timestamp,
        })
    }

    pub fn should_skip(
        &self,
        criteria: &PublishCriteria,
        history: &FeedAggregateHistory,
        caller_context: &str,
    ) -> SkipDecision {
        if let FeedType::Numerical(candidate_value) = self.value {
            let feed_id = self.encoded_feed_id;
            let res = match history.last(feed_id) {
                Some(last_published) => match last_published.value {
                    FeedType::Numerical(last) => {
                        // Note: a price can be negative,
                        // e.g. there have been cases for electricity and crude oil prices
                        // This is why we take absolute value
                        let a = f64::abs(last);
                        let diff = f64::abs(last - candidate_value);
                        let has_heartbeat_timed_out = match criteria.always_publish_heartbeat_ms {
                            Some(heartbeat) => {
                                self.end_slot_timestamp
                                    >= heartbeat + last_published.end_slot_timestamp
                            }
                            None => false,
                        };
                        let is_threshold_crossed =
                            diff * 100.0f64 >= criteria.skip_publish_if_less_then_percentage * a;
                        debug!("Result for feed_id {feed_id} from {caller_context}: last_published = {last}, candidate_value = {candidate_value}, is_threshold_crossed = {is_threshold_crossed}");
                        if is_threshold_crossed {
                            SkipDecision::DontSkip(DontSkipReason::ThresholdCrossed)
                        } else if has_heartbeat_timed_out {
                            SkipDecision::DontSkip(DontSkipReason::HeartbeatTimedOut)
                        } else {
                            SkipDecision::DoSkip(DoSkipReason::TooSimilarTooSoon)
                        }
                    }
                    _ => {
                        error!("History for numerical feed with id {feed_id} contains a non-numerical update {:?}.", last_published.value);
                        SkipDecision::DontSkip(DontSkipReason::HistoryError)
                    }
                },
                None => SkipDecision::DontSkip(DontSkipReason::NoHistory),
            };
            res
        } else {
            SkipDecision::DontSkip(DontSkipReason::NonNumericalFeed)
        }
    }
}

pub fn naive_packing(
    feed_result: &FeedType,
    digits_in_fraction: usize,
    timestamp: u64,
) -> anyhow::Result<Vec<u8>> {
    //TODO: Return Bytes32 type
    feed_result.as_bytes(digits_in_fraction, timestamp)
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct BatchedAggregatesToSend {
    pub block_height: u64,
    pub updates: Vec<VotedFeedUpdate>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct EncodedBatchedAggregatesToSend {
    pub block_height: u64,
    pub updates: Vec<EncodedVotedFeedUpdate>,
}

#[derive(Clone, Debug)]
pub struct PublishedFeedUpdate {
    pub encoded_feed_id: EncodedFeedId,
    pub num_updates: u128,
    pub value: FeedType,
    pub published: Timestamp, // in seconds since UNIX_EPOCH
}

#[derive(Clone, Debug)]
pub struct PublishedFeedUpdateError {
    pub encoded_feed_id: EncodedFeedId,
    pub num_updates: u128,
    pub error: String,
}

impl PublishedFeedUpdate {
    pub fn error(encoded_feed_id: EncodedFeedId, message: &str) -> PublishedFeedUpdateError {
        PublishedFeedUpdateError {
            encoded_feed_id,
            num_updates: 0,
            error: message.to_owned(),
        }
    }

    pub fn error_num_update(
        encoded_feed_id: EncodedFeedId,
        message: &str,
        num_updates: u128,
    ) -> PublishedFeedUpdateError {
        let mut r = PublishedFeedUpdate::error(encoded_feed_id, message);
        r.num_updates = num_updates;
        r
    }
}

#[cfg(test)]
mod tests {
    use blocksense_utils::to_hex_string;
    use std::time::SystemTime;

    use blocksense_feed_registry::types::FeedType;

    use super::*;

    #[test]
    fn naive_packing_numerical_value() {
        let value = 42.42;
        let bytes = naive_packing(&FeedType::Numerical(value), 18, 0).unwrap();

        let reversed = FeedType::from_bytes(bytes, FeedType::Numerical(0.0), 18).unwrap();

        assert_eq!(value.to_string(), reversed.parse_to_string());
    }

    #[test]
    fn naive_packing_string_value() {
        let value = "blocksense"; // size is 10
        let feed_value = FeedType::Text(value.to_string());
        let bytes = naive_packing(&feed_value, 18, 0).unwrap();

        let mut buf = [0; 10];
        buf.copy_from_slice(&bytes[..10]);
        let reversed = std::str::from_utf8(&buf).unwrap();

        assert_eq!(value, reversed);
    }

    #[test]
    fn voted_feed_update_encode() {
        let end_slot_timestamp = 1_735_902_088_000_u128; // 3 Jan 2025 time of refactoring this test
        let update = VotedFeedUpdate {
            encoded_feed_id: EncodedFeedId::new(42, 0),
            value: FeedType::Numerical(142.0),
            end_slot_timestamp,
        };
        let (encoded_key, encoded_value) = update.encode(18, 0, true).unwrap();
        assert_eq!("0000002a", to_hex_string(encoded_key, None));
        assert_eq!(
            "00000000000000000000000000000007b2a557a6d97800000000000000000000",
            to_hex_string(encoded_value, None)
        );
    }

    #[test]
    fn voted_feed_update_new_decode() {
        let end_slot_timestamp = 1_735_902_088_000_u128; // 3 Jan 2025 time of refactoring this test
                                                         // Send test votes
        let k1 = "00ab0000000000000000000000000001";
        let v1 = "000000000000000000000000000010f0da2079987e1000000000000000000000";
        let vote_1 =
            VotedFeedUpdate::new_decode(k1, 0, v1, end_slot_timestamp, FeedType::Numerical(0.0), 18)
                .unwrap();
        assert_eq!(
            vote_1.encoded_feed_id.get_id(),
            887882762809455524478714872296636417 as FeedId
        );
        assert_eq!(vote_1.value, FeedType::Numerical(80000.8f64));
    }

    #[test]
    fn voted_feed_update_should_skip() {
        let end_slot_timestamp = 1_735_902_088_000_u128; // 3 Jan 2025 time of refactoring this test
        let feed_id = 55;
        let encoded_feed_id = EncodedFeedId::new(feed_id, 0);
        let update = VotedFeedUpdate {
            encoded_feed_id: EncodedFeedId::new(feed_id, 0),
            value: FeedType::Numerical(1000.0),
            end_slot_timestamp,
        };
        let mut history = FeedAggregateHistory::new();
        history.register_feed(EncodedFeedId::new(feed_id, 0), 100);
        let always_publish_criteria = PublishCriteria {
            encoded_feed_id: EncodedFeedId::new(feed_id, 0),
            skip_publish_if_less_then_percentage: 0.0f64,
            always_publish_heartbeat_ms: None,
            peg_to_value: None,
            peg_tolerance_percentage: 0.0f64,
        };

        let one_percent_threshold = PublishCriteria {
            encoded_feed_id: EncodedFeedId::new(feed_id, 0),
            skip_publish_if_less_then_percentage: 1.0f64,
            always_publish_heartbeat_ms: None,
            peg_to_value: None,
            peg_tolerance_percentage: 0.0f64,
        };

        let always_publish_every_second = PublishCriteria {
            encoded_feed_id: EncodedFeedId::new(feed_id, 0),
            skip_publish_if_less_then_percentage: 1000.0f64,
            always_publish_heartbeat_ms: Some(1000_u128),
            peg_to_value: None,
            peg_tolerance_percentage: 0.0f64,
        };

        // No history
        assert_eq!(
            update.should_skip(&always_publish_criteria, &history, "test"),
            SkipDecision::DontSkip(DontSkipReason::NoHistory)
        );

        history.push_next(
            encoded_feed_id,
            FeedType::Numerical(1000.0f64),
            end_slot_timestamp - 1000_u128,
        );
        assert_eq!(
            update.should_skip(&always_publish_criteria, &history, "test"),
            SkipDecision::DontSkip(DontSkipReason::ThresholdCrossed)
        );
        assert_eq!(
            update.should_skip(&one_percent_threshold, &history, "test"),
            SkipDecision::DoSkip(DoSkipReason::TooSimilarTooSoon)
        );
        assert_eq!(
            update.should_skip(&always_publish_every_second, &history, "test"),
            SkipDecision::DontSkip(DontSkipReason::HeartbeatTimedOut)
        );

        history.push_next(
            encoded_feed_id,
            FeedType::Numerical(1000.0f64),
            end_slot_timestamp - 900_u128,
        );
        assert_eq!(
            update.should_skip(&always_publish_criteria, &history, "test"),
            SkipDecision::DontSkip(DontSkipReason::ThresholdCrossed)
        );
        assert_eq!(
            update.should_skip(&one_percent_threshold, &history, "test"),
            SkipDecision::DoSkip(DoSkipReason::TooSimilarTooSoon)
        );
        assert_eq!(
            update.should_skip(&always_publish_every_second, &history, "test"),
            SkipDecision::DoSkip(DoSkipReason::TooSimilarTooSoon)
        );

        let update = VotedFeedUpdate {
            encoded_feed_id,
            value: FeedType::Numerical(1010.0),
            end_slot_timestamp,
        };
        assert_eq!(
            update.should_skip(&always_publish_criteria, &history, "test"),
            SkipDecision::DontSkip(DontSkipReason::ThresholdCrossed)
        );
        // If the price is 1000 and it moved to 1010, I'd say it moved by 1%, not by 100/101 %.
        assert_eq!(
            update.should_skip(&one_percent_threshold, &history, "test"),
            SkipDecision::DontSkip(DontSkipReason::ThresholdCrossed)
        );
        let update = VotedFeedUpdate {
            encoded_feed_id,
            value: FeedType::Numerical(1009.999),
            end_slot_timestamp,
        };
        assert_eq!(
            update.should_skip(&one_percent_threshold, &history, "test"),
            SkipDecision::DoSkip(DoSkipReason::TooSimilarTooSoon)
        );
        let update = VotedFeedUpdate {
            encoded_feed_id,
            value: FeedType::Numerical(990.001),
            end_slot_timestamp,
        };
        assert_eq!(
            update.should_skip(&one_percent_threshold, &history, "test"),
            SkipDecision::DoSkip(DoSkipReason::TooSimilarTooSoon)
        );
        let update = VotedFeedUpdate {
            encoded_feed_id,
            value: FeedType::Numerical(990.000),
            end_slot_timestamp,
        };
        assert_eq!(
            update.should_skip(&one_percent_threshold, &history, "test"),
            SkipDecision::DontSkip(DontSkipReason::ThresholdCrossed)
        );

        history.push_next(
            encoded_feed_id,
            FeedType::Text("spiderman".to_owned()),
            end_slot_timestamp - 400_u128,
        );
        assert_eq!(
            update.should_skip(&one_percent_threshold, &history, "test"),
            SkipDecision::DontSkip(DontSkipReason::HistoryError)
        );
    }

    #[test]
    fn test_voted_feed_update() {
        let end_slot_timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_millis();
        let update = VotedFeedUpdate {
            encoded_feed_id: EncodedFeedId::new(42, 0),
            value: FeedType::Numerical(142.0),
            end_slot_timestamp,
        };
        let (encoded_key, encoded_value) = update.encode(18, 0, true).unwrap();
        assert_eq!("0000002a", to_hex_string(encoded_key, None));
        assert_eq!(
            "00000000000000000000000000000007b2a557a6d97800000000000000000000",
            to_hex_string(encoded_value, None)
        );

        // Send test votes
        let k1 = "00ab0000000000000000000000000001";
        let v1 = "000000000000000000000000000010f0da2079987e1000000000000000000000";
        let vote_1 =
            VotedFeedUpdate::new_decode(k1, 0, v1, end_slot_timestamp, FeedType::Numerical(0.0), 18)
                .unwrap();
        assert_eq!(
            vote_1.encoded_feed_id.get_id(),
            887882762809455524478714872296636417 as FeedId
        );
        assert_eq!(vote_1.value, FeedType::Numerical(80000.8f64));
    }
}
