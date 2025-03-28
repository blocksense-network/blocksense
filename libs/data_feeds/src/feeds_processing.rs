use anyhow::anyhow;
use config::PublishCriteria;
use feed_registry::registry::FeedAggregateHistory;
use feed_registry::types::DataFeedPayload;
use feed_registry::types::FeedType;
use feed_registry::types::Timestamp;
use log::error;
use serde::Deserialize;
use serde::Serialize;
use utils::from_hex_string;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VotedFeedUpdate {
    pub feed_id: u32,
    pub value: FeedType,
    pub end_slot_timestamp: Timestamp,
}

#[derive(Debug, Clone)]
pub struct VotedFeedUpdateWithProof {
    pub update: VotedFeedUpdate,
    pub proof: Vec<DataFeedPayload>,
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
    pub fn encode(&self, digits_in_fraction: usize, timestamp: u64) -> (Vec<u8>, Vec<u8>) {
        (
            self.feed_id.to_be_bytes().to_vec(),
            naive_packing(&self.value, digits_in_fraction, timestamp),
        )
    }

    pub fn new_decode(
        key: &str,
        value: &str,
        end_slot_timestamp: Timestamp,
        variant: FeedType, // variant is only a type placeholder.
        digits_in_fraction: usize,
    ) -> Result<VotedFeedUpdate, anyhow::Error> {
        let key_bytes = from_hex_string(key)?;
        let mut dst = [0u8; 4];
        dst.clone_from_slice(&key_bytes[0..4]);
        let feed_id = u32::from_be_bytes(dst);
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

pub fn naive_packing(feed_result: &FeedType, digits_in_fraction: usize, timestamp: u64) -> Vec<u8> {
    //TODO: Return Bytes32 type
    feed_result.as_bytes(digits_in_fraction, timestamp)
}

use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
pub struct BatchedAggegratesToSend {
    pub block_height: u64,
    pub updates: Vec<VotedFeedUpdate>,
    // The key in this map is the feed id for which we provide a proof for the aggregated value.
    pub proofs: HashMap<u32, Vec<DataFeedPayload>>,
}

impl BatchedAggegratesToSend {
    // The updates to be sent to different networks go through multiple filters.
    // Eventually we might need to reduce the proof to only contain records for
    // the relevant updates. The following function does that and returns the
    // count of removed elements.
    pub fn normalize_proof(&mut self) -> usize {
        let removed_elements_count = self.proofs.len() - self.updates.len();

        if removed_elements_count > 0 {
            let mut normalized_proofs = HashMap::new();
            for update in self.updates.iter() {
                let Some(proof) = self.proofs.remove(&update.feed_id) else {
                    error!("Logical ERROR! no proof found for key: {}", update.feed_id);
                    continue;
                };
                normalized_proofs.insert(update.feed_id, proof);
            }
            self.proofs = normalized_proofs;
        }
        removed_elements_count
    }
}

#[derive(Clone, Debug)]
pub struct PublishedFeedUpdate {
    pub feed_id: u32,
    pub num_updates: u128,
    pub value: FeedType,
    pub published: Timestamp, // in seconds since UNIX_EPOCH
}

#[derive(Clone, Debug)]
pub struct PublishedFeedUpdateError {
    pub feed_id: u32,
    pub num_updates: u128,
    pub error: String,
}

impl PublishedFeedUpdate {
    pub fn latest(
        feed_id: u32,
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

    pub fn error(feed_id: u32, message: &str) -> PublishedFeedUpdateError {
        PublishedFeedUpdateError {
            feed_id,
            num_updates: 0,
            error: message.to_owned(),
        }
    }

    pub fn error_num_update(
        feed_id: u32,
        message: &str,
        num_updates: u128,
    ) -> PublishedFeedUpdateError {
        let mut r = PublishedFeedUpdate::error(feed_id, message);
        r.num_updates = num_updates;
        r
    }

    pub fn nth(
        feed_id: u32,
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
    use std::time::SystemTime;
    use utils::to_hex_string;

    use feed_registry::types::FeedType;

    use super::*;

    #[test]
    fn naive_packing_numerical_value() {
        let value = 42.42;
        let bytes = naive_packing(&FeedType::Numerical(value), 18, 0);

        let reversed = FeedType::from_bytes(bytes, FeedType::Numerical(0.0), 18).unwrap();

        assert_eq!(value.to_string(), reversed.parse_to_string());
    }

    #[test]
    fn naive_packing_string_value() {
        let value = "blocksense"; // size is 10
        let feed_value = FeedType::Text(value.to_string());
        let bytes = naive_packing(&feed_value, 18, 0);

        let mut buf = [0; 10];
        buf.copy_from_slice(&bytes[..10]);
        let reversed = std::str::from_utf8(&buf).unwrap();

        assert_eq!(value, reversed);
    }

    #[test]
    fn voted_feed_update_encode() {
        let end_slot_timestamp = 1_735_902_088_000_u128; // 3 Jan 2025 time of refactoring this test
        let update = VotedFeedUpdate {
            feed_id: 42_u32,
            value: FeedType::Numerical(142.0),
            end_slot_timestamp,
        };
        let (encoded_key, encoded_value) = update.encode(18, 0);
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
        let k1 = "ab000001";
        let v1 = "000000000000000000000000000010f0da2079987e1000000000000000000000";
        let vote_1 =
            VotedFeedUpdate::new_decode(k1, v1, end_slot_timestamp, FeedType::Numerical(0.0), 18)
                .unwrap();
        assert_eq!(vote_1.feed_id, 2868903937_u32);
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
    }

    #[test]
    fn test_voted_feed_update() {
        let end_slot_timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_millis();
        let update = VotedFeedUpdate {
            feed_id: 42_u32,
            value: FeedType::Numerical(142.0),
            end_slot_timestamp,
        };
        let (encoded_key, encoded_value) = update.encode(18, 0);
        assert_eq!("0000002a", to_hex_string(encoded_key, None));
        assert_eq!(
            "00000000000000000000000000000007b2a557a6d97800000000000000000000",
            to_hex_string(encoded_value, None)
        );

        // Send test votes
        let k1 = "ab000001";
        let v1 = "000000000000000000000000000010f0da2079987e1000000000000000000000";
        let vote_1 =
            VotedFeedUpdate::new_decode(k1, v1, end_slot_timestamp, FeedType::Numerical(0.0), 18)
                .unwrap();
        assert_eq!(vote_1.feed_id, 2868903937_u32);
        assert_eq!(vote_1.value, FeedType::Numerical(80000.8f64));
    }
}
