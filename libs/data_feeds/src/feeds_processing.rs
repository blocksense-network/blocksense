use anyhow::anyhow;
use blocksense_config::PublishCriteria;
use blocksense_feed_registry::{
    registry::FeedAggregateHistory,
    types::{DataFeedPayload, FeedType, Timestamp},
};
use blocksense_utils::{from_hex_string, FeedId};
use log::error;
use serde::Deserialize;
use serde::Serialize;
use std::cmp::Ordering;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VotedFeedUpdate {
    pub feed_id: FeedId,
    pub value: FeedType,
    pub end_slot_timestamp: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncodedVotedFeedUpdate {
    pub feed_id: FeedId,
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
        self.update.feed_id == other.update.feed_id
    }
}

impl Eq for VotedFeedUpdateWithProof {}

// Implement Ord and PartialOrd
impl PartialOrd for VotedFeedUpdateWithProof {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.update.feed_id.cmp(&other.update.feed_id))
    }
}

impl Ord for VotedFeedUpdateWithProof {
    fn cmp(&self, other: &Self) -> Ordering {
        self.update.feed_id.cmp(&other.update.feed_id)
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
    pub fn should_skip(&self) -> bool {
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
                    if self.feed_id > u32::MAX as u128 {
                        anyhow::bail!(
                            "Error converting feed id {} to bytes for legacy contract - feed id does not fit in 4 bytes!",
                            self.feed_id,
                        )
                    }
                    (self.feed_id as u32).to_be_bytes().to_vec()
                } else {
                    self.feed_id.to_be_bytes().to_vec()
                }
            },
            {
                match naive_packing(&self.value, digits_in_fraction, timestamp) {
                    Ok(bytes) => bytes,
                    Err(e) => {
                        anyhow::bail!(
                            "Error converting value for feed id {} to bytes {}",
                            self.feed_id,
                            e
                        )
                    }
                }
            },
        ))
    }

    pub fn new_decode(
        key: &str,
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

        Ok(VotedFeedUpdate {
            feed_id,
            value,
            end_slot_timestamp,
        })
    }

    pub fn should_skip(
        &self,
        criteria: &PublishCriteria,
        history: &FeedAggregateHistory,
    ) -> SkipDecision {
        if let FeedType::Numerical(candidate_value) = self.value {
            let feed_id = self.feed_id;
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

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EncodedBatchedAggregatesToSend {
    pub block_height: u64,
    pub updates: Vec<EncodedVotedFeedUpdate>,
}

#[derive(Clone, Debug)]
pub struct PublishedFeedUpdate {
    pub feed_id: FeedId,
    pub num_updates: u128,
    pub value: FeedType,
    pub published: Timestamp, // in seconds since UNIX_EPOCH
}

#[derive(Clone, Debug)]
pub struct PublishedFeedUpdateError {
    pub feed_id: FeedId,
    pub num_updates: u128,
    pub error: String,
}

impl PublishedFeedUpdate {
    pub fn latest(
        feed_id: FeedId,
        variant: FeedType,
        digits_in_fraction: usize,
        data: &[u8],
    ) -> Result<PublishedFeedUpdate, PublishedFeedUpdateError> {
        if data.len() != 64 {
            return Err(PublishedFeedUpdate::error(
                feed_id,
                "Data size is not exactly 64 bytes",
            ));
        }
        let j1: [u8; 32] = data[0..32].try_into().expect("Impossible");
        let j2: [u8; 16] = data[48..64].try_into().expect("Impossible");
        let j3: [u8; 8] = data[24..32].try_into().expect("Impossible");
        let timestamp_u64 = u64::from_be_bytes(j3);
        match FeedType::from_bytes(j1.to_vec(), variant, digits_in_fraction) {
            Ok(latest) => Ok(PublishedFeedUpdate {
                feed_id,
                num_updates: u128::from_be_bytes(j2),
                value: latest,
                published: timestamp_u64 as u128,
            }),
            Err(msg) => Err(PublishedFeedUpdate::error(feed_id, &msg)),
        }
    }

    pub fn error(feed_id: FeedId, message: &str) -> PublishedFeedUpdateError {
        PublishedFeedUpdateError {
            feed_id,
            num_updates: 0,
            error: message.to_owned(),
        }
    }

    pub fn error_num_update(
        feed_id: FeedId,
        message: &str,
        num_updates: u128,
    ) -> PublishedFeedUpdateError {
        let mut r = PublishedFeedUpdate::error(feed_id, message);
        r.num_updates = num_updates;
        r
    }

    pub fn nth(
        feed_id: FeedId,
        num_updates: u128,
        variant: FeedType,
        digits_in_fraction: usize,
        data: &[u8],
    ) -> Result<PublishedFeedUpdate, PublishedFeedUpdateError> {
        if data.len() != 32 {
            return Err(PublishedFeedUpdate::error_num_update(
                feed_id,
                "Data size is not exactly 32 bytes",
                num_updates,
            ));
        }
        let j3: [u8; 8] = data[24..32].try_into().expect("Impossible");
        let timestamp_u64 = u64::from_be_bytes(j3);
        if timestamp_u64 == 0 {
            return Err(PublishedFeedUpdate::error_num_update(
                feed_id,
                "Timestamp is zero",
                num_updates,
            ));
        }
        let j1: [u8; 32] = data[0..32].try_into().expect("Impossible");
        match FeedType::from_bytes(j1.to_vec(), variant, digits_in_fraction) {
            Ok(value) => Ok(PublishedFeedUpdate {
                feed_id,
                num_updates,
                value,
                published: timestamp_u64 as u128,
            }),
            Err(msg) => Err(PublishedFeedUpdate::error_num_update(
                feed_id,
                &msg,
                num_updates,
            )),
        }
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
            feed_id: 42 as FeedId,
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
        let k1 = "ab000000000000000000000000000001";
        let v1 = "000000000000000000000000000010f0da2079987e1000000000000000000000";
        let vote_1 =
            VotedFeedUpdate::new_decode(k1, v1, end_slot_timestamp, FeedType::Numerical(0.0), 18)
                .unwrap();
        assert_eq!(
            vote_1.feed_id,
            227297987279220614266551007307938922497 as FeedId
        );
        assert_eq!(vote_1.value, FeedType::Numerical(80000.8f64));
    }

    #[test]
    fn voted_feed_update_should_skip() {
        let end_slot_timestamp = 1_735_902_088_000_u128; // 3 Jan 2025 time of refactoring this test
        let feed_id = 55;
        let update = VotedFeedUpdate {
            feed_id,
            value: FeedType::Numerical(1000.0),
            end_slot_timestamp,
        };
        let mut history = FeedAggregateHistory::new();
        history.register_feed(feed_id, 100);
        let always_publish_criteria = PublishCriteria {
            feed_id,
            skip_publish_if_less_then_percentage: 0.0f64,
            always_publish_heartbeat_ms: None,
            peg_to_value: None,
            peg_tolerance_percentage: 0.0f64,
        };

        let one_percent_threshold = PublishCriteria {
            feed_id,
            skip_publish_if_less_then_percentage: 1.0f64,
            always_publish_heartbeat_ms: None,
            peg_to_value: None,
            peg_tolerance_percentage: 0.0f64,
        };

        let always_publish_every_second = PublishCriteria {
            feed_id,
            skip_publish_if_less_then_percentage: 1000.0f64,
            always_publish_heartbeat_ms: Some(1000_u128),
            peg_to_value: None,
            peg_tolerance_percentage: 0.0f64,
        };

        // No history
        assert_eq!(
            update.should_skip(&always_publish_criteria, &history),
            SkipDecision::DontSkip(DontSkipReason::NoHistory)
        );

        history.push_next(
            feed_id,
            FeedType::Numerical(1000.0f64),
            end_slot_timestamp - 1000_u128,
        );
        assert_eq!(
            update.should_skip(&always_publish_criteria, &history),
            SkipDecision::DontSkip(DontSkipReason::ThresholdCrossed)
        );
        assert_eq!(
            update.should_skip(&one_percent_threshold, &history),
            SkipDecision::DoSkip(DoSkipReason::TooSimilarTooSoon)
        );
        assert_eq!(
            update.should_skip(&always_publish_every_second, &history),
            SkipDecision::DontSkip(DontSkipReason::HeartbeatTimedOut)
        );

        history.push_next(
            feed_id,
            FeedType::Numerical(1000.0f64),
            end_slot_timestamp - 900_u128,
        );
        assert_eq!(
            update.should_skip(&always_publish_criteria, &history),
            SkipDecision::DontSkip(DontSkipReason::ThresholdCrossed)
        );
        assert_eq!(
            update.should_skip(&one_percent_threshold, &history),
            SkipDecision::DoSkip(DoSkipReason::TooSimilarTooSoon)
        );
        assert_eq!(
            update.should_skip(&always_publish_every_second, &history),
            SkipDecision::DoSkip(DoSkipReason::TooSimilarTooSoon)
        );

        let update = VotedFeedUpdate {
            feed_id,
            value: FeedType::Numerical(1010.0),
            end_slot_timestamp,
        };
        assert_eq!(
            update.should_skip(&always_publish_criteria, &history),
            SkipDecision::DontSkip(DontSkipReason::ThresholdCrossed)
        );
        // If the price is 1000 and it moved to 1010, I'd say it moved by 1%, not by 100/101 %.
        assert_eq!(
            update.should_skip(&one_percent_threshold, &history),
            SkipDecision::DontSkip(DontSkipReason::ThresholdCrossed)
        );
        let update = VotedFeedUpdate {
            feed_id,
            value: FeedType::Numerical(1009.999),
            end_slot_timestamp,
        };
        assert_eq!(
            update.should_skip(&one_percent_threshold, &history),
            SkipDecision::DoSkip(DoSkipReason::TooSimilarTooSoon)
        );
        let update = VotedFeedUpdate {
            feed_id,
            value: FeedType::Numerical(990.001),
            end_slot_timestamp,
        };
        assert_eq!(
            update.should_skip(&one_percent_threshold, &history),
            SkipDecision::DoSkip(DoSkipReason::TooSimilarTooSoon)
        );
        let update = VotedFeedUpdate {
            feed_id,
            value: FeedType::Numerical(990.000),
            end_slot_timestamp,
        };
        assert_eq!(
            update.should_skip(&one_percent_threshold, &history),
            SkipDecision::DontSkip(DontSkipReason::ThresholdCrossed)
        );

        history.push_next(
            feed_id,
            FeedType::Text("spiderman".to_owned()),
            end_slot_timestamp - 400_u128,
        );
        assert_eq!(
            update.should_skip(&one_percent_threshold, &history),
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
            feed_id: 42 as FeedId,
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
        let k1 = "ab000000000000000000000000000001";
        let v1 = "000000000000000000000000000010f0da2079987e1000000000000000000000";
        let vote_1 =
            VotedFeedUpdate::new_decode(k1, v1, end_slot_timestamp, FeedType::Numerical(0.0), 18)
                .unwrap();
        assert_eq!(
            vote_1.feed_id,
            227297987279220614266551007307938922497 as FeedId
        );
        assert_eq!(vote_1.value, FeedType::Numerical(80000.8f64));
    }
}
