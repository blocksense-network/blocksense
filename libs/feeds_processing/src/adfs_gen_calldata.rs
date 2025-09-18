use alloy::hex;
use alloy_primitives::U256;
use anyhow::Result;
use blocksense_config::FeedStrideAndDecimals;
use blocksense_data_feeds::feeds_processing::BatchedAggregatesToSend;
use blocksense_utils::{from_hex_string, to_hex_string, FeedId};
use std::cmp::max;
use std::collections::{BTreeMap, HashMap, HashSet};

use tracing::{error, info};

use once_cell::sync::Lazy;

pub const MAX_HISTORY_ELEMENTS_PER_FEED: u64 = 8192;
pub const NUM_FEED_IDS_IN_ROUND_RECORD: u128 = 16;

pub type RoundCounters = HashMap<FeedId, u64>; // for each key (feed_id) we store its round counter

static STRIDES_SIZES: Lazy<HashMap<u8, u32>> = Lazy::new(|| {
    let mut map = HashMap::new(); // TODO: confirm the correct values for the strides we will support
    map.insert(0, 32);
    map.insert(1, 64);
    map.insert(2, 128);
    map.insert(3, 256);
    map.insert(4, 512);
    map.insert(5, 1024);
    map.insert(6, 2048);
    map.insert(7, 4096);
    map
});

fn truncate_leading_zero_bytes(bytes: Vec<u8>) -> Vec<u8> {
    // Skip leading zero bytes and collect the remaining bytes into a new Vec
    let mut result: Vec<u8> = bytes.into_iter().skip_while(|&x| x == 0).collect();

    if result.is_empty() {
        result.push(0);
    }

    result
}

fn encode_packed(items: &[&[u8]]) -> (Vec<u8>, String) {
    /// Pack a single `SolidityDataType` into bytes
    fn pack(b: &[u8]) -> Vec<u8> {
        let mut res = Vec::new();
        res.extend(b);
        res
    }

    let res = items.iter().fold(Vec::new(), |mut acc, i| {
        let pack = pack(i);
        acc.push(pack);
        acc
    });
    let res = res.join(&[][..]);
    let hexed = hex::encode(&res);
    (res, hexed)
}

/// Serializes the `updates` hash map into a string.
pub async fn adfs_serialize_updates(
    net: &str,
    feed_updates: &BatchedAggregatesToSend,
    round_counters: Option<&RoundCounters>,
    strides_and_decimals: HashMap<FeedId, FeedStrideAndDecimals>,
    feeds_rounds: &mut HashMap<FeedId, u64>, /* The rounds table for the relevant feeds. If the round_counters are provided,
                                             this map will be filled with the update count for each feed from it. If the
                                             round_counters is None, feeds_rounds will be used as the source of the updates
                                             count. */
) -> Result<Vec<u8>> {
    let mut result = Vec::<u8>::new();
    let updates = &feed_updates.updates;

    info!("Preparing a batch of ADFS feeds for network `{net}`");
    result.push(0x01);
    result.append(&mut feed_updates.block_height.to_be_bytes().to_vec());
    result.append(&mut (updates.len() as u32).to_be_bytes().to_vec());

    let mut feeds_info = HashMap::new();
    let mut feeds_ids_with_value_updates = HashSet::new();

    // Fill the value updates:
    for update in updates.iter() {
        let feed_id = update.feed_id;
        feeds_ids_with_value_updates.insert(feed_id);

        let (stride, digits_in_fraction) = match &strides_and_decimals.get(&feed_id) {
            Some(f) => (f.stride, f.decimals),
            None => {
                error!("Propagating result for unregistered feed! Support left for legacy one shot feeds of 32 bytes size. Decimal default to 18");
                (0, 18)
            }
        };

        let mut round = match &round_counters {
            Some(rc) => {
                let mut updated_feed_id_round: u64 = 0;
                // Add the feed id-s that are part of each record that will be updated
                for additional_feed_id in get_neighbour_feed_ids(update.feed_id) {
                    let round = rc.get(&additional_feed_id).cloned().unwrap_or(0);


                    let (stride, _digits_in_fraction) = match &strides_and_decimals
                        .get(&additional_feed_id)
                    {
                        Some(f) => (f.stride, f.decimals),
                        None => {
                            error!("Propagating result for unregistered feed! Support left for legacy one shot feeds of 32 bytes size. Decimal default to 18");
                            (0, 18)
                        }
                    };
                    feeds_info.insert(additional_feed_id, (stride, round));
                    if additional_feed_id == update.feed_id {
                        updated_feed_id_round = round;
                    }
                }
                updated_feed_id_round
            }
            None => *feeds_rounds.get(&feed_id).unwrap_or_else(|| {
                error!("feeds_rounds does not contain updates count for feed_id {feed_id}. Rolling back to 0!");
                &0
            }),
        };

        round %= MAX_HISTORY_ELEMENTS_PER_FEED;

        let (_key, val) = match update.encode(
            digits_in_fraction as usize,
            update.end_slot_timestamp as u64,
            false,
        ) {
            Ok((k, v)) => (k, v),
            Err(e) => {
                error!(
                    "Got an error trying to encode value of feed ID {}: {}",
                    update.feed_id, e
                );
                continue;
            }
        }; // Key is not needed. It is the bytes of the feed_id

        let id = U256::from(update.feed_id);
        let round = U256::from(round);
        let index = (id * U256::from(2).pow(U256::from(13u32)) + round)
            * U256::from(2).pow(U256::from(stride));
        let index_in_bytes_length = truncate_leading_zero_bytes(index.to_be_bytes_vec()).len();
        let bytes = val.len();
        let stride_size = *STRIDES_SIZES.get(&stride).unwrap_or_else(|| {
            error!("Trying to process unsupported stride {stride}!");
            &0
        });
        if bytes as u32 > stride_size {
            error!("Error trying to forward data of {bytes} bytes, larger than the stride size of {stride_size} for feed: {id}");
            continue;
        }
        let bytes_vec = truncate_leading_zero_bytes(bytes.to_be_bytes().to_vec());
        let bytes_length = bytes_vec.len();

        let stride_as_byte = [stride; 1];
        let index_in_bytes_length = [index_in_bytes_length as u8; 1];
        let bytes_length = [bytes_length as u8; 1];
        let index = truncate_leading_zero_bytes(index.to_be_bytes_vec());

        let packed_result = vec![
            &stride_as_byte,
            &index_in_bytes_length,
            index.as_slice(),
            &bytes_length,
            bytes_vec.as_slice(),
            &val,
        ];

        let (mut result_bytes, _hex) = encode_packed(&packed_result);

        result.append(&mut result_bytes);
    }

    // In case feed_metrics is none, the feeds_rounds contains all the round indexes needed for serialization.
    // We use them to populate feeds_info map based on which the round indexes will be serialized
    if round_counters.is_none() {
        for (feed_id, round) in feeds_rounds.iter() {
            if let Some(strides_and_decimals) = strides_and_decimals.get(feed_id) {
                feeds_info.insert(*feed_id, (strides_and_decimals.stride, *round));
            } else {
                feeds_info.insert(*feed_id, (0, 0));
            };
        }
    };

    // Fill the round tables:
    let mut batch_feeds = BTreeMap::new();

    for (feed_id, (stride, mut round)) in feeds_info.iter() {
        feeds_rounds.insert(*feed_id, round);
        if !feeds_ids_with_value_updates.contains(feed_id) && round > 0 {
            round -= 1; // Get the index of the last updated value
        }
        let round = U256::from(round % MAX_HISTORY_ELEMENTS_PER_FEED);
        let row_index = (U256::from(2).pow(U256::from(115)) * U256::from(*stride)
            + U256::from(*feed_id))
            / U256::from(NUM_FEED_IDS_IN_ROUND_RECORD);
        let slot_position = feed_id % NUM_FEED_IDS_IN_ROUND_RECORD;

        batch_feeds.entry(row_index).or_insert_with(|| {
            // Initialize new row with zeros
            let mut val = "0x".to_string();
            val.push_str("0".repeat(64).as_str());
            val
        });

        // Convert round to 2b hex and pad if needed
        let round_bytes = round.to_be_bytes_vec();
        let round_hex =
            to_hex_string(round_bytes[round_bytes.len() - 2..].to_vec(), None).to_string();
        let position: usize = slot_position as usize * 4;

        let v = batch_feeds.get_mut(&row_index).unwrap();
        let temp = format!(
            "{}{}{}",
            &v[0..position + 2].to_string(),
            round_hex,
            &v[position + 6..].to_string()
        );
        v.clear();
        v.push_str(temp.as_str());
    }

    let mut round_data = Vec::<u8>::new();

    for (index, val) in batch_feeds {
        let index_in_bytes_length = max(index.to_be_bytes_trimmed_vec().len(), 1);
        let index_in_bytes_length = [index_in_bytes_length as u8; 1];
        let index_bytes = truncate_leading_zero_bytes(index.to_be_bytes_vec());

        let val = from_hex_string(&val[2..]).unwrap();

        let packed_result = vec![&index_in_bytes_length, index_bytes.as_slice(), &val];

        let (mut result_bytes, _hex) = encode_packed(&packed_result);

        round_data.append(&mut result_bytes);
    }

    result.append(&mut round_data);

    info!("Serialized result: {}", hex::encode(result.clone()));

    Ok(result)
}

/// Serializes the `updates` hash map into a string.
pub async fn adfs_serialize_updates_faulty(
    net: &str,
    feed_updates: &BatchedAggregatesToSend,
    round_counters: Option<&RoundCounters>,
    strides_and_decimals: HashMap<FeedId, FeedStrideAndDecimals>,
    feeds_rounds: &mut HashMap<FeedId, u64>, /* The rounds table for the relevant feeds. If the round_counters are provided,
                                             this map will be filled with the update count for each feed from it. If the
                                             round_counters is None, feeds_rounds will be used as the source of the updates
                                             count. */
) -> Result<Vec<u8>> {
    let mut result = Vec::<u8>::new();
    let updates = &feed_updates.updates;

    info!("Preparing a batch of ADFS feeds for network `{net}`");
    result.push(0x01);
    result.append(&mut feed_updates.block_height.to_be_bytes().to_vec());
    result.append(&mut (updates.len() as u32).to_be_bytes().to_vec());

    let mut feeds_info = HashMap::new();
    let mut feeds_ids_with_value_updates = HashSet::new();

    // Fill the value updates:
    for update in updates.iter() {
        let feed_id = update.feed_id;
        feeds_ids_with_value_updates.insert(feed_id);

        let (stride, digits_in_fraction) = match &strides_and_decimals.get(&feed_id) {
            Some(f) => (f.stride, f.decimals),
            None => {
                error!("Propagating result for unregistered feed! Support left for legacy one shot feeds of 32 bytes size. Decimal default to 18");
                (0, 18)
            }
        };

        let mut round = match &round_counters {
            Some(rc) => {
                let mut updated_feed_id_round: u64 = 0;
                // Add the feed id-s that are part of each record that will be updated
                for additional_feed_id in get_neighbour_feed_ids(update.feed_id) {
                    let round = rc.get(&additional_feed_id).cloned().unwrap_or(0);


                    let (stride, _digits_in_fraction) = match &strides_and_decimals
                        .get(&additional_feed_id)
                    {
                        Some(f) => (f.stride, f.decimals),
                        None => {
                            error!("Propagating result for unregistered feed! Support left for legacy one shot feeds of 32 bytes size. Decimal default to 18");
                            (0, 18)
                        }
                    };
                    feeds_info.insert(additional_feed_id, (stride, round));
                    if additional_feed_id == update.feed_id {
                        updated_feed_id_round = round;
                    }
                }
                updated_feed_id_round
            }
            None => *feeds_rounds.get(&feed_id).unwrap_or_else(|| {
                error!("feeds_rounds does not contain updates count for feed_id {feed_id}. Rolling back to 0!");
                &0
            }),
        };

        round %= MAX_HISTORY_ELEMENTS_PER_FEED;

        let (_key, val) = match update.encode(
            digits_in_fraction as usize,
            update.end_slot_timestamp as u64,
            false,
        ) {
            Ok((k, v)) => (k, v),
            Err(e) => {
                error!(
                    "Got an error trying to encode value of feed ID {}: {}",
                    update.feed_id, e
                );
                continue;
            }
        }; // Key is not needed. It is the bytes of the feed_id

        let id = U256::from(update.feed_id);
        let round = U256::from(round);
        let index = (id * U256::from(2).pow(U256::from(13u32)) + round)
            * U256::from(2).pow(U256::from(stride));
        let index_in_bytes_length = truncate_leading_zero_bytes(index.to_be_bytes_vec()).len();
        let bytes = val.len();
        let stride_size = *STRIDES_SIZES.get(&stride).unwrap_or_else(|| {
            error!("Trying to process unsupported stride {stride}!");
            &0
        });
        if bytes as u32 > stride_size {
            error!("Error trying to forward data of {bytes} bytes, larger than the stride size of {stride_size} for feed: {id}");
            continue;
        }
        let bytes_vec = truncate_leading_zero_bytes(bytes.to_be_bytes().to_vec());
        let bytes_length = bytes_vec.len();

        let stride_as_byte = [stride; 1];
        let index_in_bytes_length = [index_in_bytes_length as u8; 1];
        let bytes_length = [bytes_length as u8; 1];
        let index = truncate_leading_zero_bytes(index.to_be_bytes_vec());

        let packed_result = vec![
            &stride_as_byte,
            &index_in_bytes_length,
            index.as_slice(),
            &bytes_length,
            bytes_vec.as_slice(),
            &val,
        ];

        let (mut result_bytes, _hex) = encode_packed(&packed_result);

        result.append(&mut result_bytes);
    }

    // In case feed_metrics is none, the feeds_rounds contains all the round indexes needed for serialization.
    // We use them to populate feeds_info map based on which the round indexes will be serialized
    if round_counters.is_none() {
        for (feed_id, round) in feeds_rounds.iter() {
            if let Some(strides_and_decimals) = strides_and_decimals.get(feed_id) {
                feeds_info.insert(*feed_id, (strides_and_decimals.stride, *round));
            } else {
                feeds_info.insert(*feed_id, (0, 0));
            };
        }
    };

    // Fill the round tables:
    let mut batch_feeds = BTreeMap::new();

    for (feed_id, (stride, mut round)) in feeds_info.iter() {
        feeds_rounds.insert(*feed_id, round);
        if !feeds_ids_with_value_updates.contains(feed_id) && round > 0 {
            round -= 1; // Get the index of the last updated value
        }
        let round = U256::from(round);
        let row_index = (U256::from(2).pow(U256::from(115)) * U256::from(*stride)
            + U256::from(*feed_id))
            / U256::from(NUM_FEED_IDS_IN_ROUND_RECORD);
        let slot_position = feed_id % NUM_FEED_IDS_IN_ROUND_RECORD;

        batch_feeds.entry(row_index).or_insert_with(|| {
            // Initialize new row with zeros
            let mut val = "0x".to_string();
            val.push_str("0".repeat(64).as_str());
            val
        });

        // Convert round to 2b hex and pad if needed
        let round_bytes = round.to_be_bytes_vec();
        let round_hex =
            to_hex_string(round_bytes[round_bytes.len() - 2..].to_vec(), None).to_string();
        let position: usize = slot_position as usize * 4;

        let v = batch_feeds.get_mut(&row_index).unwrap();
        let temp = format!(
            "{}{}{}",
            &v[0..position + 2].to_string(),
            round_hex,
            &v[position + 6..].to_string()
        );
        v.clear();
        v.push_str(temp.as_str());
    }

    let mut round_data = Vec::<u8>::new();

    for (index, val) in batch_feeds {
        let index_in_bytes_length = max(index.to_be_bytes_trimmed_vec().len(), 1);
        let index_in_bytes_length = [index_in_bytes_length as u8; 1];
        let index_bytes = truncate_leading_zero_bytes(index.to_be_bytes_vec());

        let val = from_hex_string(&val[2..]).unwrap();

        let packed_result = vec![&index_in_bytes_length, index_bytes.as_slice(), &val];

        let (mut result_bytes, _hex) = encode_packed(&packed_result);

        round_data.append(&mut result_bytes);
    }

    result.append(&mut round_data);

    info!("Serialized result: {}", hex::encode(result.clone()));

    Ok(result)
}

pub fn get_neighbour_feed_ids(feed_id: FeedId) -> Vec<FeedId> {
    let additional_feeds_begin: FeedId = feed_id - (feed_id % NUM_FEED_IDS_IN_ROUND_RECORD);
    let additional_feeds_end: FeedId = additional_feeds_begin + NUM_FEED_IDS_IN_ROUND_RECORD;

    (additional_feeds_begin..additional_feeds_end).collect()
}

#[cfg(test)]
pub mod tests {
    use blocksense_data_feeds::feeds_processing::VotedFeedUpdate;
    use blocksense_feed_registry::types::FeedType;

    use super::*;

    // Helper function to create VotedFeedUpdate
    fn create_voted_feed_update(feed_id: FeedId, value: &str) -> VotedFeedUpdate {
        let bytes = from_hex_string(value).unwrap();
        VotedFeedUpdate {
            feed_id,
            value: FeedType::from_bytes(bytes, FeedType::Bytes(Vec::new()), 18).unwrap(),
            end_slot_timestamp: 0,
        }
    }

    fn default_config() -> HashMap<FeedId, FeedStrideAndDecimals> {
        let mut config = HashMap::new();
        for feed_id in 0..16 {
            config.insert(
                feed_id,
                FeedStrideAndDecimals {
                    stride: 0,
                    decimals: 18,
                },
            );
        }
        config.insert(
            1,
            FeedStrideAndDecimals {
                stride: 1,
                decimals: 18,
            },
        );
        config
    }

    fn setup_updates_rounds_and_config(
        updates_init: &[(FeedId, &str)],
        round_counters_init: &[(FeedId, u64)],
        config_init: HashMap<FeedId, FeedStrideAndDecimals>,
    ) -> (
        BatchedAggregatesToSend,
        RoundCounters,
        HashMap<FeedId, FeedStrideAndDecimals>,
    ) {
        let updates = BatchedAggregatesToSend {
            block_height: 3515857925,
            updates: updates_init
                .iter()
                .map(|(feed_id, value)| create_voted_feed_update(*feed_id, value))
                .collect(),
        };

        let mut round_counters = RoundCounters::new();
        for (feed_id, round) in round_counters_init.iter() {
            round_counters.insert(*feed_id, *round);
        }

        (updates, round_counters, config_init)
    }

    #[tokio::test]
    async fn test_adfs_serialize() {
        let net = "ETH";

        let updates_init = vec![
            (1, "12343267643573"),
            (2, "2456"),
            (3, "3678"),
            (4, "4890"),
            (5, "5abc"),
        ];
        let round_counters_init = vec![(1, 6), (2, 5), (3, 4), (4, 3), (5, 2)];

        let config_init = default_config();
        let (updates, round_counters, config) =
            setup_updates_rounds_and_config(&updates_init, &round_counters_init, config_init);

        let expected_result = "0100000000499602d2000000050102400c0107123432676435730002400501022456000260040102367800028003010248900002a00201025abc010000000000000500040003000200000000000000000000000000000000000000000e80000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000";

        let mut feeds_rounds = HashMap::new();

        // Call as it will be in the sequencer
        assert_eq!(
            expected_result,
            hex::encode(
                adfs_serialize_updates(
                    net,
                    &updates,
                    Some(&round_counters),
                    config.clone(),
                    &mut feeds_rounds,
                )
                .await
                .unwrap()
            )
        );

        // Call as it will be in the reporter (feeds_rounds provided by the sequencer)
        assert_eq!(
            expected_result,
            hex::encode(
                adfs_serialize_updates(net, &updates, None, config, &mut feeds_rounds,)
                    .await
                    .unwrap()
            )
        );
    }

    #[tokio::test]
    async fn test_adfs_serialize_with_non_zero_counter_in_neighbour() {
        let net = "ETH";

        let updates_init = vec![
            (1, "12343267643573"),
            (2, "2456"),
            (3, "3678"),
            (4, "4890"),
            (5, "5abc"),
        ];
        let round_counters_init = vec![(1, 6), (2, 5), (3, 4), (4, 3), (5, 2)];

        let config_init = default_config();
        let (updates, mut round_counters, config) =
            setup_updates_rounds_and_config(&updates_init, &round_counters_init, config_init);
        round_counters.insert(6, 5);

        let expected_result = "0100000000499602d2000000050102400c0107123432676435730002400501022456000260040102367800028003010248900002a00201025abc010000000000000500040003000200040000000000000000000000000000000000000e80000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000";

        let mut feeds_rounds = HashMap::new();

        // Call as it will be in the sequencer
        assert_eq!(
            expected_result,
            hex::encode(
                adfs_serialize_updates(
                    net,
                    &updates,
                    Some(&round_counters),
                    config.clone(),
                    &mut feeds_rounds,
                )
                .await
                .unwrap()
            )
        );

        // Call as it will be in the reporter (feeds_rounds provided by the sequencer)
        assert_eq!(
            expected_result,
            hex::encode(
                adfs_serialize_updates(net, &updates, None, config, &mut feeds_rounds,)
                    .await
                    .unwrap()
            )
        );
    }

    #[tokio::test]
    async fn test_adfs_serialize_with_wrap_around_index() {
        let net = "ETH";

        let updates_init = vec![
            (1, "12343267643573"),
            (2, "2456"),
            (3, "3678"),
            (4, "4890"),
            (5, "5abc"),
        ];
        let round_counters_init = vec![(1, 6), (2, 5), (3, 4), (4, 9000), (5, 2)];

        let config_init = default_config();
        let (updates, mut round_counters, config) =
            setup_updates_rounds_and_config(&updates_init, &round_counters_init, config_init);
        round_counters.insert(6, 5);

        let expected_result = "0100000000499602d2000000050102400c0107123432676435730002400501022456000260040102367800028328010248900002a00201025abc010000000000000500040328000200040000000000000000000000000000000000000e80000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000";

        let mut feeds_rounds = HashMap::new();

        // Call as it will be in the sequencer
        assert_eq!(
            expected_result,
            hex::encode(
                adfs_serialize_updates(
                    net,
                    &updates,
                    Some(&round_counters),
                    config.clone(),
                    &mut feeds_rounds,
                )
                .await
                .unwrap()
            )
        );

        // Call as it will be in the reporter (feeds_rounds provided by the sequencer)
        assert_eq!(
            expected_result,
            hex::encode(
                adfs_serialize_updates(net, &updates, None, config, &mut feeds_rounds,)
                    .await
                    .unwrap()
            )
        );
    }

    #[tokio::test]
    async fn test_adfs_serialize_with_wrap_around_index_fuzzy() {
        let net = "ETH";

        let updates_init = vec![
            ( 31,           "00000000000000000000000000000000000000000210b2c5000001994cbb3000" ),
            ( 36,           "00000000000000000000000000000000001260358a52d403000001994cbb3000" ),
            ( 48,           "00000000000000000000000000000000000000000242eb20000001994cbb3000" ),
            ( 61,           "000000000000000000000000000000000000000dddeeeb27000001994cbb3000" ),
            ( 68,           "000000000000000000000000000000002bd705c34d758000000001994cbb3000" ),
            ( 70,           "0000000000000000000000000000000002e6a77a9f04a20e000001994cbb3000" ),
            ( 90,           "00000000000000000000000000000000000000077be2a80a000001994cbb3000" ),
            ( 95,           "0000000000000000000000000000000000000007ad7691c0000001994cbb3000" ),
            ( 98,           "0000000000000000000000000000000000000007aa2f5600000001994cbb3000" ),
            ( 101,          "0000000000000000000000000000000000000000369409a1000001994cbb3000" ),
            ( 113,          "000000000000000000000000000000003d4bc9a972af62c0000001994cbb3000" ),
            ( 115,          "00000000000000000000000000000000000000000fae379c000001994cbb3000" ),
            ( 160,          "000000000000000000000000000000000e520b952fb9c000000001994cbb3000" ),
            ( 161,          "00000000000000000000000000000000000000001c2029d9000001994cbb3000" ),
            ( 173,          "0000000000000000000000000000000000eba7d89828fb40000001994cbb3000" ),
            ( 174,          "000000000000000000000000000000000000000700430f49000001994cbb3000" ),
            ( 177,          "000000000000000000000000000000000000000009d925bd000001994cbb3000" ),
            ( 192,          "000000000000000000000000000000000000000009d8e76a000001994cbb3000" ),
            ( 201,          "0000000000000000000000000000000017b7967201248000000001994cbb3000" ),
            ( 217,          "000000000000000000000000000000000001e7cda2294a1c000001994cbb3000" ),
            ( 233,          "000000000000000000000000000000000427a899370555c4000001994cbb3000" ),
            ( 234,          "000000000000000000000000000000000427a638ca523f76000001994cbb3000" ),
            ( 236,          "0000000000000000000000000000000000000029ff7103ec000001994cbb3000" ),
            ( 239,          "000000000000000000000000000000000000002a008f0780000001994cbb3000" ),
            ( 261,          "00000000000000000000000000000000000000000b5945ff000001994cbb3000" ),
            ( 280,          "00000000000000000000000000000000000000000b5945ff000001994cbb3000" ),
            ( 292,          "000000000000000000000000000000000000000003e4237e000001994cbb3000" ),
            ( 293,          "0000000000000000000000000000000008cc33bedbe11a70000001994cbb3000" ),
            ( 294,          "0000000000000000000000000000000008cce92108bc4408000001994cbb3000" ),
            ( 301,          "00000000000000000000000000000000160dc1bb0cee2198000001994cbb3000" ),
            ( 302,          "000000000000000000000000000000001609b5021cdb87a4000001994cbb3000" ),
            ( 303,          "000000000000000000000000000000000000000004df19d0000001994cbb3000" ),
            ( 315,          "00000000000000000000000000000000014c1485a690d502000001994cbb3000" ),
            ( 325,          "000000000000000000000000000000000475d798decf8000000001994cbb3000" ),
            ( 326,          "00000000000000000000000000000000000014f180f69bda000001994cbb3000" ),
            ( 361,          "00000000000000000000000000000000000014efc366d8d6000001994cbb3000" ),
            ( 373,          "00000000000000000000000000000000000014f46b040000000001994cbb3000" ),
            ( 374,          "0000000000000000000000000000000010979fdd8d750000000001994cbb3000" ),
            ( 375,          "000000000000000000000000000000000000000002d03718000001994cbb3000" ),
            ( 378,          "00000000000000000000000000000000003c2b780b3aa07b000001994cbb3000" ),
            ( 386,          "0000000000000000000000000000000000000000047f7e1f000001994cbb3000" ),
            ( 399,          "0000000000000000000000000000000019babb2d55930000000001994cbb3000" ),
            ( 400,          "00000000000000000000000000000000000000008aba2eed000001994cbb3000" ),
            ( 412,          "00000000000000000000000000000000000000008ab579ee000001994cbb3000" ),
            ( 417,          "0000000000000000000000000000000000000000020ab506000001994cbb3000" ),
            ( 418,          "000000000000000000000000000000000000000002079964000001994cbb3000" ),
            ( 420,          "000000000000000000000000000000000000991165b73800000001994cbb3000" ),
            ( 423,          "0000000000000000000000000000000000000000048a4310000001994cbb3000" ),
            ( 459,          "0000000000000000000000000000000000000000048cb410000001994cbb3000" ),
            ( 465,          "000000000000000000000000000000029c03c0d012e60bf0000001994cbb3000" ),
            ( 473,          "00000000000000000000000000000002c5d94dfee53b0000000001994cbb3000" ),
            ( 474,          "0000000000000000000000000000000001e6a3b0bb35a3fc000001994cbb3000" ),
            ( 475,          "0000000000000000000000000000000001e674560ecce122000001994cbb3000" ),
            ( 476,          "0000000000000000000000000000000000000000018e4120000001994cbb3000" ),
            ( 487,          "0000000000000000000000000000000000000000018e4120000001994cbb3000" ),
            ( 510,          "000000000000000000000000000000000000000007970bc3000001994cbb3000" ),
            ( 511,          "000000000000000000000000000000000000000007975ae1000001994cbb3000" ),
            ( 512,          "00000000000000000000000000000000000000000794eb00000001994cbb3000" ),
            ( 519,          "000000000000000000000000000000006161d7710f18ac98000001994cbb3000" ),
            ( 520,          "0000000000000000000000000000000000000000010fe578000001994cbb3000" ),
            ( 537,          "0000000000000000000000000000000000009e408830dfff000001994cbb3000" ),
            ( 538,          "000000000000000000000000000000000000000004b2501c000001994cbb3000" ),
            ( 543,          "000000000000000000000000000000000000000004b2501c000001994cbb3000" ),
            ( 557,          "00000000000000000000000000000000111d8fd0d17d4000000001994cbb3000" ),
            ( 560,          "0000000000000000000000000000000000000001065e8750000001994cbb3000" ),
            ( 579,          "00000000000000000000000000000000120139bd4a252458000001994cbb3000" ),
            ( 580,          "000000000000000000000000000000000000000350f89af1000001994cbb3000" ),
            ( 602,          "0000000000000000000000000000000000000003511676a1000001994cbb3000" ),
            ( 606,          "0000000000000000000000000000000000000000000bcf8b000001994cbb3000" ),
            ( 616,          "0000000000000000000000000000000000000000000bf5dc000001994cbb3000" ),
            ( 623,          "000000000000000000000000000000000b713661b14f4000000001994cbb3000" ),
            ( 628,          "0000000000000000000000000000000016ad6f220f50c418000001994cbb3000" ),
            ( 629,          "0000000000000000000000000000000016ad226e972d1734000001994cbb3000" ),
            ( 637,          "0000000000000000000000000000000001b1b95aa151244a000001994cbb3000" ),
            ( 638,          "0000000000000000000000000000000001daa523cd136a6a000001994cbb3000" ),
            ( 641,          "0000000000000000000000000000000000000009115d583a000001994cbb3000" ),
            ( 650,          "0000000000000000000000000000000000000009115d583a000001994cbb3000" ),
            ( 651,          "000000000000000000000000000000000126fba412a94af0000001994cbb3000" ),
            ( 678,          "0000000000000000000000000000000001268716b8824a06000001994cbb3000" ),
            ( 684,          "000000000000000000000000000000000128703ce80f0000000001994cbb3000" ),
            ( 689,          "000000000000000000000000000000000006b70e92b2f0e5000001994cbb3000" ),
            ( 698,          "000000000000000000000000000000000006badb16991800000001994cbb3000" ),
            ( 699,          "0000000000000000000000000000000000000000077db2c5000001994cbb3000" ),
            ( 700,          "00000000000000000000000000000000000361e22f659a7b000001994cbb3000" ),
            ( 712,          "00000000000000000000000000000000000361e22f659a7b000001994cbb3000" ),
            ( 713,          "000000000000000000000000000000000000000004503baa000001994cbb3000" ),
            ( 10000,        "000000000000000000000000000000000000000004503baa000001994cbb3000" ),
            ( 10014,        "0000000000000000000000000000000084c85d4e7af00000000001994cbb3000" ),
            ( 10021,        "0000000000000000000000000000000000000000144dfb19000001994cbb3000" ),
            ( 10025,        "000000000000000000000000000000000000000014503200000001994cbb3000" ),
            ( 10027,        "00000000000000000000000000000000000000000016fd53000001994cbb3000" ),
            ( 10034,        "00000000000000000000000000000000000000000016fc62000001994cbb3000" ),
            ( 10038,        "000000000000000000000000000000000000007d67abe243000001994cbb3000" ),
            ( 10051,        "000000000000000000000000000000000000007d656fc6b3000001994cbb3000" ),
            ( 10052,        "000000000000000000000000000000000000000004a57d2c000001994cbb3000" ),
            ( 10057,        "000000000000000000000000000000000000000004a5aa4a000001994cbb3000" ),
            ( 10058,        "00000000000000000000000000000000140eba0bd5786b54000001994cbb3000" ),
            ( 10059,        "00000000000000000000000000000000140e8739cab95188000001994cbb3000" ),
            ( 10062,        "000000000000000000000000000000000000000000689665000001994cbb3000" ),
            ( 10063,        "000000000000000000000000000000000000000000689376000001994cbb3000" ),
            ( 10069,        "0000000000000000000000000000000003abb1593f174000000001994cbb3000" ),
            ( 10070,        "00000000000000000000000000000000000285721bc990b0000001994cbb3000" ),
            ( 10072,        "000000000000000000000000000000000002856eef571f57000001994cbb3000" ),
            ( 10076,        "0000000000000000000000000000000000000000004070c5000001994cbb3000" ),
            ( 10077,        "000000000000000000000000000000000000000001092f34000001994cbb3000" ),
            ( 10078,        "000000000000000000000000000000000000000001092f34000001994cbb3000" ),
            ( 10080,        "0000000000000000000000000000000001db1ac1ac7910de000001994cbb3000" ),
            ( 10083,        "0000000000000000000000000000000001db1ac1ac7910de000001994cbb3000" ),
            ( 10084,        "000000000000000000000000000000000963e59a4f9c8a88000001994cbb3000" ),
            ( 10086,        "000000000000000000000000000000000963e59a4f9c8a88000001994cbb3000" ),
            ( 10090,        "0000000000000000000000000000000000000000018c84c6000001994cbb3000" ),
            ( 10093,        "000000000000000000000000000000000000000028e5f8d6000001994cbb3000" ),
            ( 10096,        "000000000000000000000000000000000000000028e55b42000001994cbb3000" ),
            ( 10099,        "00000000000000000000000000000000000000000003e32a000001994cbb3000" ),
            ( 10101,        "00000000000000000000000000000000000000000005d5d8000001994cbb3000" ),
            ( 10104,        "000000000000000000000000000000000008fb33ddfdffff000001994cbb3000" ),
            ( 10105,        "000000000000000000000000000000000000000007e57c00000001994cbb3000" ),
            ( 10106,        "0000000000000000000000000000000000000000001bb77c000001994cbb3000" ),
            ( 10111,        "0000000000000000000000000000000000000000001bb77c000001994cbb3000" ),
            ( 10112,        "0000000000000000000000000000000002ed446ebf214000000001994cbb3000" ),
            ( 10115,        "00000000000000000000000000000000007629d36d9ed76c000001994cbb3000" ),
            ( 10118,        "00000000000000000000000000000000000000000000c06e000001994cbb3000" ),
            ( 10120,        "00000000000000000000000000000000000000000000c067000001994cbb3000" ),
            ( 10121,        "00000000000000000000000000000000000723a38fd2dd00000001994cbb3000" ),
            ( 10123,        "00000000000000000000000000000000000723c2c0d995b6000001994cbb3000" ),
            ( 10134,        "0000000000000000000000000000000000000000001c2597000001994cbb3000" ),
        ];
        let round_counters_init = vec![
            ( 31,                  2474 ),
            ( 36,                  5841 ),
            ( 48,                  6449 ),
            ( 61,                  4726 ),
            ( 68,                  4293 ),
            ( 70,                  7988 ),
            ( 90,                  7779 ),
            ( 95,                  6862 ),
            ( 98,                  6541 ),
            ( 101,                 7953 ),
            ( 113,                 7045 ),
            ( 115,                 4964 ),
            ( 160,                 6771 ),
            ( 161,                 6984 ),
            ( 173,                 4243 ),
            ( 174,                 4243 ),
            ( 177,                 7262 ),
            ( 192,                 6995 ),
            ( 201,                 6181 ),
            ( 217,                 7108 ),
            ( 233,                 6975 ),
            ( 234,                 7253 ),
            ( 236,                 7412 ),
            ( 239,                 7092 ),
            ( 261,                 7447 ),
            ( 280,                 7623 ),
            ( 292,                 6380 ),
            ( 293,                 6452 ),
            ( 294,                 6204 ),
            ( 301,                 7293 ),
            ( 302,                 7557 ),
            ( 303,                 7607 ),
            ( 315,                 6707 ),
            ( 325,                 4380 ),
            ( 326,                 4744 ),
            ( 361,                 8835 ),
            ( 373,                 7794 ),
            ( 374,                 7873 ),
            ( 375,                 6912 ),
            ( 378,                 5942 ),
            ( 386,                 6639 ),
            ( 399,                 7375 ),
            ( 400,                 7376 ),
            ( 412,                 8173 ),
            ( 417,                 5325 ),
            ( 418,                 5600 ),
            ( 420,                 5322 ),
            ( 423,                 5756 ),
            ( 459,                 8132 ),
            ( 465,                 8107 ),
            ( 473,                 6904 ),
            ( 474,                 6937 ),
            ( 475,                 6427 ),
            ( 476,                 6427 ),
            ( 487,                 5926 ),
            ( 510,                 3784 ),
            ( 511,                 7293 ),
            ( 512,                 7293 ),
            ( 519,                 5979 ),
            ( 520,                 5892 ),
            ( 537,                 7006 ),
            ( 538,                 7006 ),
            ( 543,                 7449 ),
            ( 557,                 7714 ),
            ( 560,                 8177 ),
            ( 579,                 7925 ),
            ( 580,                 7924 ),
            ( 602,                 10947),
            ( 606,                 7034 ),
            ( 616,                 7945 ),
            ( 623,                 7824 ),
            ( 628,                 6413 ),
            ( 629,                 6413 ),
            ( 637,                 6442 ),
            ( 638,                 6375 ),
            ( 641,                 4784 ),
            ( 650,                 5104 ),
            ( 651,                 5179 ),
            ( 678,                 6702 ),
            ( 684,                 12949),
            ( 689,                 8608 ),
            ( 698,                 5825 ),
            ( 699,                 5819 ),
            ( 700,                 10157),
            ( 712,                 7943 ),
            ( 713,                 7943 ),
            ( 10000,               183  ),
            ( 10014,               5349 ),
            ( 10021,               7405 ),
            ( 10025,               2976 ),
            ( 10027,               7248 ),
            ( 10034,               7813 ),
            ( 10038,               3145 ),
            ( 10051,               7915 ),
            ( 10052,               7279 ),
            ( 10057,               6567 ),
            ( 10058,               8125 ),
            ( 10059,               8106 ),
            ( 10062,               2466 ),
            ( 10063,               3665 ),
            ( 10069,               3786 ),
            ( 10070,               5966 ),
            ( 10072,               6020 ),
            ( 10076,               7214 ),
            ( 10077,               5507 ),
            ( 10078,               5629 ),
            ( 10080,               8070 ),
            ( 10083,               7806 ),
            ( 10084,               7695 ),
            ( 10086,               8141 ),
            ( 10090,               8032 ),
            ( 10093,               3718 ),
            ( 10096,               2919 ),
            ( 10099,               7847 ),
            ( 10101,               6317 ),
            ( 10104,               7990 ),
            ( 10105,               5264 ),
            ( 10106,               7867 ),
            ( 10111,               3691 ),
            ( 10112,               8085 ),
            ( 10115,               4335 ),
            ( 10118,               3675 ),
            ( 10120,               6922 ),
            ( 10121,               5170 ),
            ( 10123,               3606 ),
            ( 10134,               7810 ),
        ];

        let config_init = default_config();
        let (updates, mut round_counters, config) =
            setup_updates_rounds_and_config(&updates_init, &round_counters_init, config_init);
        round_counters.insert(6, 5);

        let expected_result = "0100000000";

        let mut feeds_rounds = HashMap::new();

        // Call as it will be in the sequencer
        assert_eq!(
            hex::encode(
                adfs_serialize_updates(
                    net,
                    &updates,
                    Some(&round_counters),
                    config.clone(),
                    &mut feeds_rounds,
                )
                .await
                .unwrap()
            ),
            hex::encode(
                adfs_serialize_updates_faulty(
                    net,
                    &updates,
                    Some(&round_counters),
                    config.clone(),
                    &mut feeds_rounds,
                )
                .await
                .unwrap()
            )
        );

        // Call as it will be in the reporter (feeds_rounds provided by the sequencer)
        assert_eq!(
            expected_result,
            hex::encode(
                adfs_serialize_updates(net, &updates, None, config, &mut feeds_rounds,)
                    .await
                    .unwrap()
            )
        );
    }
}
