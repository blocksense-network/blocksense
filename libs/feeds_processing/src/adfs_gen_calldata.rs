use alloy::hex;
use alloy_primitives::U256;
use anyhow::Result;
use blocksense_config::FeedStrideAndDecimals;
use blocksense_data_feeds::feeds_processing::BatchedAggegratesToSend;
use blocksense_utils::{from_hex_string, to_hex_string};
use std::cmp::max;
use std::collections::{BTreeMap, HashMap, HashSet};

use tracing::{error, info};

use once_cell::sync::Lazy;

const MAX_HISTORY_ELEMENTS_PER_FEED: u64 = 8192;
const NUM_FEED_IDS_IN_ROUND_RECORD: u32 = 16;

pub type RoundCounters = HashMap<u32, u64>; // for each key (feed_id) we store its round counter

static STRIDES_SIZES: Lazy<HashMap<u16, u32>> = Lazy::new(|| {
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
    feed_updates: &BatchedAggegratesToSend,
    round_counters: Option<&RoundCounters>,
    strides_and_decimals: HashMap<u32, FeedStrideAndDecimals>,
    feeds_rounds: &mut HashMap<u32, u64>, /* The rounds table for the relevant feeds. If the round_counters are provided,
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

        let (_key, val) = update.encode(
            digits_in_fraction as usize,
            update.end_slot_timestamp as u64,
        ); // Key is not needed. It is the bytes of the feed_id

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

        let stride_as_byte = [stride as u8; 1];
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

pub fn get_neighbour_feed_ids(feed_id: u32) -> Vec<u32> {
    let additional_feeds_begin: u32 = feed_id - (feed_id % NUM_FEED_IDS_IN_ROUND_RECORD);
    let additional_feeds_end: u32 = additional_feeds_begin + NUM_FEED_IDS_IN_ROUND_RECORD;

    (additional_feeds_begin..additional_feeds_end).collect()
}

#[cfg(test)]
pub mod tests {
    use blocksense_data_feeds::feeds_processing::VotedFeedUpdate;
    use blocksense_feed_registry::types::FeedType;

    use super::*;

    // Helper function to create VotedFeedUpdate
    fn create_voted_feed_update(feed_id: u32, value: &str) -> VotedFeedUpdate {
        let bytes = from_hex_string(value).unwrap();
        VotedFeedUpdate {
            feed_id,
            value: FeedType::from_bytes(bytes, FeedType::Bytes(Vec::new()), 18).unwrap(),
            end_slot_timestamp: 0,
        }
    }

    fn setup_updates_rounds_and_config() -> (
        BatchedAggegratesToSend,
        HashMap<u32, u64>,
        HashMap<u32, FeedStrideAndDecimals>,
    ) {
        let updates = BatchedAggegratesToSend {
            block_height: 1234567890,
            updates: vec![
                create_voted_feed_update(1, "12343267643573"),
                create_voted_feed_update(2, "2456"),
                create_voted_feed_update(3, "3678"),
                create_voted_feed_update(4, "4890"),
                create_voted_feed_update(5, "5abc"),
            ],
        };

        let mut round_counters = RoundCounters::new();
        round_counters.insert(1, 6);
        round_counters.insert(2, 5);
        round_counters.insert(3, 4);
        round_counters.insert(4, 3);
        round_counters.insert(5, 2);

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
        (updates, round_counters, config)
    }

    #[tokio::test]
    async fn test_adfs_serialize() {
        let net = "ETH";

        let (updates, round_counters, config) = setup_updates_rounds_and_config();

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

        let (updates, mut round_counters, config) = setup_updates_rounds_and_config();
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
}
