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

impl VotedFeedUpdate {
    pub fn encode(&self, digits_in_fraction: usize) -> (Vec<u8>, Vec<u8>) {
        (
            self.feed_id.to_be_bytes().to_vec(),
            naive_packing(&self.value, digits_in_fraction),
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

    pub fn should_skip(&self, criteria: &PublishCriteria, history: &FeedAggregateHistory) -> bool {
        if let FeedType::Numerical(candidate_value) = self.value {
            let feed_id = self.feed_id;
            let res =
                history
                    .last(feed_id)
                    .is_some_and(|last_published| match last_published.value {
                        FeedType::Numerical(last) => {
                            // Note: a price can be negative,
                            // e.g. there have been cases for electricity and crude oil prices
                            // This is why we take absolute value
                            let a = f64::abs(last);
                            let diff = f64::abs(last - candidate_value);
                            let skip_time_check =
                                criteria
                                    .always_publish_heartbeat_ms.is_none_or(|heartbeat| {
                                        self.end_slot_timestamp < heartbeat + last_published.end_slot_timestamp
                                    });
                            let skip_diff_check = diff * 100.0f64 < criteria.skip_publish_if_less_then_percentage * a;
                            skip_diff_check && skip_time_check
                        }
                        _ => {
                            error!("History for numerical feed with id {feed_id} contains a non-numerical update {:?}.", last_published.value);
                            false
                        }
                    });
            res
        } else {
            false
        }
    }
}

pub const REPORT_HEX_SIZE: usize = 64;

pub fn naive_packing(feed_result: &FeedType, digits_in_fraction: usize) -> Vec<u8> {
    //TODO: Return Bytes32 type
    feed_result.as_bytes(digits_in_fraction)
}

#[derive(Debug)]
pub struct PublishedFeedUpdate {
    pub feed_id: u32,
    pub num_updates: u128,
    pub value: Option<FeedType>,
    pub published: Timestamp, // in seconds since UNIX_EPOCH
    pub error: Option<String>,
}

impl PublishedFeedUpdate {
    pub fn latest(
        feed_id: u32,
        variant: FeedType,
        digits_in_fraction: usize,
        data: &[u8],
    ) -> PublishedFeedUpdate {
        if data.len() != 64 {
            return PublishedFeedUpdate::error(
                feed_id,
                "Data published per feed update should be exactrly 64 bytes",
            );
        }
        let j1: [u8; 32] = data[0..32].try_into().expect("Imposible");
        let j2: [u8; 16] = data[48..64].try_into().expect("Imposible");
        let j3: [u8; 8] = data[24..32].try_into().expect("Imposible");
        let timestamp_u64 = u64::from_be_bytes(j3);
        match FeedType::from_bytes(j1.to_vec(), variant, digits_in_fraction) {
            Ok(latest) => PublishedFeedUpdate {
                feed_id,
                num_updates: u128::from_be_bytes(j2),
                value: Some(latest),
                published: timestamp_u64 as u128,
                error: None,
            },
            Err(msg) => PublishedFeedUpdate::error(feed_id, &msg),
        }
    }

    pub fn none(feed_id: u32) -> PublishedFeedUpdate {
        PublishedFeedUpdate {
            feed_id,
            num_updates: 0,
            value: None,
            published: 0,
            error: None,
        }
    }

    pub fn error(feed_id: u32, message: &str) -> PublishedFeedUpdate {
        PublishedFeedUpdate {
            feed_id,
            num_updates: 0,
            value: None,
            published: 0,
            error: Some(message.to_string()),
        }
    }

    pub fn error_num_update(feed_id: u32, message: &str, num_updates: u128) -> PublishedFeedUpdate {
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
    ) -> PublishedFeedUpdate {
        if data.len() != 32 {
            return PublishedFeedUpdate::error_num_update(feed_id, "Not availble", num_updates);
        }
        let j3: [u8; 8] = data[24..32].try_into().expect("Imposible");
        let timestamp_u64 = u64::from_be_bytes(j3);
        if timestamp_u64 == 0 {
            return PublishedFeedUpdate::error_num_update(feed_id, "Not availble", num_updates);
        }
        let j1: [u8; 32] = data[0..32].try_into().expect("Imposible");
        //let digits_in_fraction = 18_usize;
        match FeedType::from_bytes(j1.to_vec(), variant, digits_in_fraction) {
            Ok(value) => PublishedFeedUpdate {
                feed_id,
                num_updates,
                value: Some(value),
                published: timestamp_u64 as u128,
                error: None,
            },
            Err(msg) => PublishedFeedUpdate::error_num_update(feed_id, &msg, num_updates),
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
        let bytes = naive_packing(&FeedType::Numerical(value), 18);

        let reversed = FeedType::from_bytes(bytes, FeedType::Numerical(0.0), 18).unwrap();

        assert_eq!(value.to_string(), reversed.parse_to_string());
    }

    #[test]
    fn naive_packing_string_value() {
        let value = "blocksense"; // size is 10
        let feed_value = FeedType::Text(value.to_string());
        let bytes = naive_packing(&feed_value, 18);

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
        let (encoded_key, encoded_value) = update.encode(18);
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
            false
        );

        history.push_next(
            feed_id,
            FeedType::Numerical(1000.0f64),
            end_slot_timestamp - 1000_u128,
        );
        assert_eq!(
            update.should_skip(&always_publish_criteria, &history),
            false
        );
        assert_eq!(update.should_skip(&one_percent_threshold, &history), true);
        assert_eq!(
            update.should_skip(&always_publish_every_second, &history),
            false
        );

        history.push_next(
            feed_id,
            FeedType::Numerical(1000.0f64),
            end_slot_timestamp - 900_u128,
        );
        assert_eq!(
            update.should_skip(&always_publish_criteria, &history),
            false
        );
        assert_eq!(update.should_skip(&one_percent_threshold, &history), true);
        assert_eq!(
            update.should_skip(&always_publish_every_second, &history),
            true
        ); // only 900 ms since last update, shoud be skipped

        let update = VotedFeedUpdate {
            feed_id,
            value: FeedType::Numerical(1010.0),
            end_slot_timestamp,
        };
        assert_eq!(
            update.should_skip(&always_publish_criteria, &history),
            false
        );
        // If the price is 1000 and it moved to 1010, I'd say it moved by 1%, not by 100/101 %.
        assert_eq!(update.should_skip(&one_percent_threshold, &history), false);
        let update = VotedFeedUpdate {
            feed_id,
            value: FeedType::Numerical(1009.999),
            end_slot_timestamp,
        };
        assert_eq!(update.should_skip(&one_percent_threshold, &history), true);
        let update = VotedFeedUpdate {
            feed_id,
            value: FeedType::Numerical(990.001),
            end_slot_timestamp,
        };
        assert_eq!(update.should_skip(&one_percent_threshold, &history), true);
        let update = VotedFeedUpdate {
            feed_id,
            value: FeedType::Numerical(990.000),
            end_slot_timestamp,
        };
        assert_eq!(update.should_skip(&one_percent_threshold, &history), false);
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
        let (encoded_key, encoded_value) = update.encode(18);
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
