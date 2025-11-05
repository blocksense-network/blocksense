use alloy::hex;
use alloy_primitives::U256;
use anyhow::{bail, ensure, Result};
use blocksense_config::FeedStrideAndDecimals;
use blocksense_data_feeds::feeds_processing::BatchedAggregatesToSend;
use blocksense_utils::{from_hex_string, to_hex_string, EncodedFeedId, FeedId, Stride};
use std::cmp::max;
use std::collections::{BTreeMap, HashMap, HashSet};

use tracing::{error, info};

use once_cell::sync::Lazy;

pub const MAX_HISTORY_ELEMENTS_PER_FEED: u64 = 8192;
pub const NUM_FEED_IDS_IN_RB_INDEX_RECORD: u128 = 16;

pub type RingBufferIndices = HashMap<EncodedFeedId, u64>; // for each key (feed_id) we store its ring buffer index

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

pub fn calc_row_index(feed_id: FeedId, stride: Stride) -> alloy_primitives::Uint<256, 4> {
    (U256::from(2).pow(U256::from(115)) * U256::from(stride) + U256::from(feed_id))
        / U256::from(NUM_FEED_IDS_IN_RB_INDEX_RECORD)
}

/// Serializes the `updates` hash map into a string.
pub async fn adfs_serialize_updates(
    net: &str,
    feed_updates: &BatchedAggregatesToSend,
    rb_indices: Option<&RingBufferIndices>,
    strides_and_decimals: HashMap<EncodedFeedId, FeedStrideAndDecimals>,
    feeds_rb_indexes: &mut HashMap<EncodedFeedId, u64>, /* The ring buffer indices table for the relevant feeds. If the rb_indices are provided,
                                                        this map will be filled with the update count for each feed from it. If the
                                                        rb_indices is None, feeds_rb_indexes will be used as the source of the updates
                                                        count. */
) -> Result<Vec<u8>> {
    let mut result = Vec::<u8>::new();
    let updates = &feed_updates.updates;

    info!("Preparing a batch of ADFS feeds for network `{net}`");
    result.append(&mut (updates.len() as u32).to_be_bytes().to_vec());

    let mut feeds_info = HashMap::new();
    let mut feeds_ids_with_value_updates = HashSet::new();

    // Fill the value updates:
    for update in updates.iter() {
        let encoded_feed_id = update.encoded_feed_id;
        feeds_ids_with_value_updates.insert(encoded_feed_id);

        let (stride, digits_in_fraction) = match &strides_and_decimals.get(&encoded_feed_id) {
            Some(f) => (f.stride, f.decimals),
            None => {
                error!("Propagating result for unregistered feed! Support left for legacy one shot feeds of 32 bytes size. Decimal default to 18");
                (0, 18)
            }
        };

        let mut rb_index = match &rb_indices {
            Some(rc) => {
                let mut updated_feed_id_rb_index: u64 = 0;
                // Add the feed id-s that are part of each record that will be updated
                for additional_feed_id in get_neighbour_feed_ids(update.encoded_feed_id) {
                    let rb_index = rc.get(&additional_feed_id).cloned().unwrap_or(0);


                    let (stride, _digits_in_fraction) = match &strides_and_decimals
                        .get(&additional_feed_id)
                    {
                        Some(f) => (f.stride, f.decimals),
                        None => {
                            error!("Propagating result for unregistered feed! Support left for legacy one shot feeds of 32 bytes size. Decimal default to 18");
                            (0, 18)
                        }
                    };
                    feeds_info.insert(additional_feed_id, (stride, rb_index));
                    if additional_feed_id == update.encoded_feed_id {
                        updated_feed_id_rb_index = rb_index;
                    }
                }
                updated_feed_id_rb_index
            }
            None => *feeds_rb_indexes.get(&encoded_feed_id).unwrap_or_else(|| {
                error!("feeds_rb_indexes does not contain updates count for feed_id {encoded_feed_id}. Rolling back to 0!");
                &0
            }),
        };

        rb_index %= MAX_HISTORY_ELEMENTS_PER_FEED;

        let (_key, val) = match update.encode(
            digits_in_fraction as usize,
            update.end_slot_timestamp as u64,
            false,
        ) {
            Ok((k, v)) => (k, v),
            Err(e) => {
                error!(
                    "Got an error trying to encode value of feed ID {}: {}",
                    update.encoded_feed_id, e
                );
                continue;
            }
        }; // Key is not needed. It is the bytes of the feed_id

        let id = U256::from(update.encoded_feed_id.get_id());
        let rb_index = U256::from(rb_index);
        let index = (id * U256::from(2).pow(U256::from(13u32)) + rb_index)
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

    // In case feed_metrics is none, the feeds_rb_indexes contains all the ring buffer indices needed for serialization.
    // We use them to populate feeds_info map based on which the ring buffer indices will be serialized
    if rb_indices.is_none() {
        for (feed_id, rb_index) in feeds_rb_indexes.iter() {
            if let Some(strides_and_decimals) = strides_and_decimals.get(feed_id) {
                feeds_info.insert(*feed_id, (strides_and_decimals.stride, *rb_index));
            } else {
                feeds_info.insert(*feed_id, (0, 0));
            };
        }
    };

    // Fill the rb_index tables:
    let mut batch_feeds = BTreeMap::new();

    for (encoded_feed_id, (stride, mut rb_index)) in feeds_info.iter() {
        feeds_rb_indexes.insert(*encoded_feed_id, rb_index);
        if !feeds_ids_with_value_updates.contains(encoded_feed_id) && rb_index > 0 {
            rb_index -= 1; // Get the index of the last updated value
        }
        let feed_id = encoded_feed_id.get_id();
        let rb_index = U256::from(rb_index % MAX_HISTORY_ELEMENTS_PER_FEED);
        let row_index = calc_row_index(feed_id, *stride);
        let slot_position = feed_id % NUM_FEED_IDS_IN_RB_INDEX_RECORD;

        batch_feeds.entry(row_index).or_insert_with(|| {
            // Initialize new row with zeros
            let mut val = "0x".to_string();
            val.push_str("0".repeat(64).as_str());
            val
        });

        // Convert rb_index to 2b hex and pad if needed
        let rb_index_bytes = rb_index.to_be_bytes_vec();
        let rb_index_hex =
            to_hex_string(rb_index_bytes[rb_index_bytes.len() - 2..].to_vec(), None).to_string();
        let position: usize = slot_position as usize * 4;

        let v = batch_feeds.get_mut(&row_index).unwrap();
        let temp = format!(
            "{}{}{}",
            &v[0..position + 2].to_string(),
            rb_index_hex,
            &v[position + 6..].to_string()
        );
        v.clear();
        v.push_str(temp.as_str());
    }

    let mut rb_indices_data = Vec::<u8>::new();

    for (index, val) in batch_feeds {
        let index_in_bytes_length = max(index.to_be_bytes_trimmed_vec().len(), 1);
        let index_in_bytes_length = [index_in_bytes_length as u8; 1];
        let index_bytes = truncate_leading_zero_bytes(index.to_be_bytes_vec());

        let val = from_hex_string(&val[2..]).unwrap();

        let packed_result = vec![&index_in_bytes_length, index_bytes.as_slice(), &val];

        let (mut result_bytes, _hex) = encode_packed(&packed_result);

        rb_indices_data.append(&mut result_bytes);
    }

    result.append(&mut rb_indices_data);

    info!("Serialized result: {}", hex::encode(result.clone()));

    Ok(result)
}

pub fn adfs_deserialize_updates(bytes: &[u8]) -> Result<Vec<(EncodedFeedId, Vec<u8>, u64)>> {
    ensure!(bytes.len() >= 4, "serialized payload shorter than header");

    let mut cursor = 0usize;
    let feeds_count = read_u32(bytes, &mut cursor)? as usize;

    #[derive(Debug)]
    struct PendingUpdate {
        encoded_feed_id: EncodedFeedId,
        value: Vec<u8>,
        expected_round_index: u64,
    }

    let mut pending_updates = Vec::with_capacity(feeds_count);
    let round_index_mask = (U256::from(1) << 13) - U256::from(1);

    for _ in 0..feeds_count {
        let stride = read_u8(bytes, &mut cursor)?;

        let index_len = read_u8(bytes, &mut cursor)? as usize;
        ensure!(index_len > 0, "index length cannot be zero");
        let index_bytes = read_bytes(bytes, &mut cursor, index_len)?;
        let index = U256::from_be_slice(index_bytes);

        let base_index = index >> stride;
        ensure!(
            (base_index << stride) == index,
            "index is not aligned with the provided stride"
        );

        let feed_id_u256 = base_index >> 13;
        let feed_id = u256_to_u128(feed_id_u256)?;

        let expected_round_index = u256_to_u64(base_index & round_index_mask)?;

        let bytes_length_len = read_u8(bytes, &mut cursor)? as usize;
        ensure!(
            bytes_length_len > 0,
            "bytes length indicator cannot be zero"
        );
        let length_bytes = read_bytes(bytes, &mut cursor, bytes_length_len)?;
        let value_length_u64 = be_bytes_to_u64(length_bytes)?;
        ensure!(
            value_length_u64 <= usize::MAX as u64,
            "value length does not fit in usize"
        );
        let value_length = value_length_u64 as usize;

        let value = read_bytes(bytes, &mut cursor, value_length)?.to_vec();

        let encoded_feed_id = EncodedFeedId::new(feed_id, stride);

        pending_updates.push(PendingUpdate {
            encoded_feed_id,
            value,
            expected_round_index,
        });
    }

    let mut rows: HashMap<U256, [u16; NUM_FEED_IDS_IN_RB_INDEX_RECORD as usize]> = HashMap::new();

    while cursor < bytes.len() {
        let index_len = read_u8(bytes, &mut cursor)? as usize;
        ensure!(index_len > 0, "row index length cannot be zero");
        let index_bytes = read_bytes(bytes, &mut cursor, index_len)?;
        let row_index = U256::from_be_slice(index_bytes);

        let row_bytes = read_bytes(bytes, &mut cursor, 32)?;
        ensure!(
            row_bytes.len() == 32,
            "row payload must be exactly 32 bytes"
        );

        let mut slots = [0u16; NUM_FEED_IDS_IN_RB_INDEX_RECORD as usize];
        for (slot, chunk) in row_bytes.chunks_exact(2).enumerate() {
            slots[slot] = u16::from_be_bytes([chunk[0], chunk[1]]);
        }

        rows.insert(row_index, slots);
    }

    ensure!(cursor == bytes.len(), "payload contains trailing bytes");

    let mut result = Vec::with_capacity(pending_updates.len());

    for pending in pending_updates {
        let (stride, feed_id) = pending.encoded_feed_id.decode();
        let row_index = calc_row_index(feed_id, stride);

        let slots = match rows.get(&row_index) {
            Some(value) => value,
            None => bail!(
                "missing ring buffer row for feed {}",
                pending.encoded_feed_id
            ),
        };

        let slot_position = (feed_id % NUM_FEED_IDS_IN_RB_INDEX_RECORD) as usize;
        ensure!(
            slot_position < slots.len(),
            "slot position {} out of range",
            slot_position
        );

        let round_index = slots[slot_position] as u64;
        ensure!(
            round_index == pending.expected_round_index,
            "round index mismatch for feed {}: {} (table) != {} (value)",
            pending.encoded_feed_id,
            round_index,
            pending.expected_round_index
        );

        result.push((pending.encoded_feed_id, pending.value, round_index));
    }

    Ok(result)
}

fn read_u8(data: &[u8], cursor: &mut usize) -> Result<u8> {
    ensure!(
        *cursor < data.len(),
        "unexpected end of payload while reading byte"
    );
    let value = data[*cursor];
    *cursor += 1;
    Ok(value)
}

fn read_u32(data: &[u8], cursor: &mut usize) -> Result<u32> {
    let bytes = read_bytes(data, cursor, 4)?;
    let mut arr = [0u8; 4];
    arr.copy_from_slice(bytes);
    Ok(u32::from_be_bytes(arr))
}

fn read_bytes<'a>(data: &'a [u8], cursor: &mut usize, len: usize) -> Result<&'a [u8]> {
    ensure!(*cursor <= data.len(), "cursor is beyond payload boundary");
    ensure!(
        len <= data.len() - *cursor,
        "unexpected end of payload while reading {len} bytes"
    );
    let start = *cursor;
    let end = start + len;
    *cursor = end;
    Ok(&data[start..end])
}

fn be_bytes_to_u64(bytes: &[u8]) -> Result<u64> {
    ensure!(
        !bytes.is_empty(),
        "length field must contain at least one byte"
    );
    ensure!(
        bytes.len() <= 8,
        "length field longer than 8 bytes: {}",
        bytes.len()
    );

    let mut buf = [0u8; 8];
    let offset = 8 - bytes.len();
    buf[offset..].copy_from_slice(bytes);
    Ok(u64::from_be_bytes(buf))
}

fn tail_array<const N: usize>(bytes: &[u8]) -> Result<[u8; N]> {
    ensure!(
        bytes.len() >= N,
        "not enough bytes to extract fixed-width array"
    );
    let split = bytes.len() - N;
    ensure!(
        bytes[..split].iter().all(|&b| b == 0),
        "value does not fit into target width"
    );
    let mut arr = [0u8; N];
    arr.copy_from_slice(&bytes[split..]);
    Ok(arr)
}

fn u256_to_u128(value: U256) -> Result<u128> {
    let bytes = value.to_be_bytes_vec();
    let arr = tail_array::<16>(&bytes)?;
    Ok(u128::from_be_bytes(arr))
}

fn u256_to_u64(value: U256) -> Result<u64> {
    let bytes = value.to_be_bytes_vec();
    let arr = tail_array::<8>(&bytes)?;
    Ok(u64::from_be_bytes(arr))
}

pub fn get_neighbour_feed_ids(encoded_feed_id: EncodedFeedId) -> Vec<EncodedFeedId> {
    let feed_id = encoded_feed_id.get_id();
    let stride = encoded_feed_id.get_stride();
    let additional_feeds_begin: FeedId = feed_id - (feed_id % NUM_FEED_IDS_IN_RB_INDEX_RECORD);
    let additional_feeds_end: FeedId = additional_feeds_begin + NUM_FEED_IDS_IN_RB_INDEX_RECORD;

    (additional_feeds_begin..additional_feeds_end)
        .map(|fid| EncodedFeedId::new(fid, stride))
        .collect()
}

#[cfg(test)]
pub mod tests {
    use blocksense_data_feeds::feeds_processing::VotedFeedUpdate;
    use blocksense_feed_registry::types::FeedType;

    use super::*;

    // Helper function to create VotedFeedUpdate
    fn create_voted_feed_update(encoded_feed_id: EncodedFeedId, value: &str) -> VotedFeedUpdate {
        let bytes = from_hex_string(value).unwrap();
        VotedFeedUpdate {
            encoded_feed_id,
            value: FeedType::from_bytes(bytes, FeedType::Bytes(Vec::new()), 18).unwrap(),
            end_slot_timestamp: 0,
        }
    }

    fn default_config() -> HashMap<EncodedFeedId, FeedStrideAndDecimals> {
        let mut config = HashMap::new();
        for feed_id in 0..16 {
            config.insert(
                EncodedFeedId::new(feed_id, 0),
                FeedStrideAndDecimals {
                    stride: 0,
                    decimals: 18,
                },
            );
        }
        config.insert(
            EncodedFeedId::new(1, 0),
            FeedStrideAndDecimals {
                stride: 1,
                decimals: 18,
            },
        );
        config
    }

    fn setup_updates_rb_indices_and_config(
        updates_init: &[(EncodedFeedId, &str)],
        rb_indices_init: &[(EncodedFeedId, u64)],
        config_init: HashMap<EncodedFeedId, FeedStrideAndDecimals>,
    ) -> (
        BatchedAggregatesToSend,
        RingBufferIndices,
        HashMap<EncodedFeedId, FeedStrideAndDecimals>,
    ) {
        let updates = BatchedAggregatesToSend {
            block_height: 1234567890,
            updates: updates_init
                .iter()
                .map(|(feed_id, value)| create_voted_feed_update(*feed_id, value))
                .collect(),
        };

        let mut rb_indices = RingBufferIndices::new();
        for (feed_id, rb_index) in rb_indices_init.iter() {
            rb_indices.insert(*feed_id, *rb_index);
        }

        (updates, rb_indices, config_init)
    }

    fn encoded_feed_id_for_stride_zero(feed_id: FeedId) -> EncodedFeedId {
        EncodedFeedId::new(feed_id, 0)
    }

    fn assert_deserialized_updates(
        updates: &BatchedAggregatesToSend,
        config: &HashMap<EncodedFeedId, FeedStrideAndDecimals>,
        rb_indices: &RingBufferIndices,
        actual: &[(EncodedFeedId, Vec<u8>, u64)],
    ) {
        assert_eq!(actual.len(), updates.updates.len());

        for (idx, update) in updates.updates.iter().enumerate() {
            let (encoded_feed_id, value_bytes, round_index) = &actual[idx];
            let feed_config = config
                .get(&update.encoded_feed_id)
                .unwrap_or_else(|| panic!("missing config for feed {}", update.encoded_feed_id));

            let expected_encoded_feed_id =
                EncodedFeedId::new(update.encoded_feed_id.get_id(), feed_config.stride);

            assert_eq!(
                encoded_feed_id, &expected_encoded_feed_id,
                "Unexpected feed position at index {}",
                idx
            );

            let (_key, expected_value) = update
                .encode(
                    feed_config.decimals as usize,
                    update.end_slot_timestamp as u64,
                    false,
                )
                .expect("failed to encode update for comparison");

            assert_eq!(
                value_bytes, &expected_value,
                "value mismatch for feed {}",
                encoded_feed_id
            );

            let expected_round_index = rb_indices
                .iter()
                .find_map(|(id, value)| {
                    (id.get_id() == update.encoded_feed_id.get_id())
                        .then_some(*value % MAX_HISTORY_ELEMENTS_PER_FEED)
                })
                .unwrap_or_else(|| {
                    panic!(
                        "missing rb index for feed id {}",
                        update.encoded_feed_id.get_id()
                    )
                });

            assert_eq!(
                *round_index, expected_round_index,
                "round index mismatch for feed {}",
                encoded_feed_id
            );
        }
    }

    #[tokio::test]
    async fn test_adfs_serialize() {
        let net = "ETH";

        let updates_init = vec![
            (encoded_feed_id_for_stride_zero(1), "12343267643573"),
            (encoded_feed_id_for_stride_zero(2), "2456"),
            (encoded_feed_id_for_stride_zero(3), "3678"),
            (encoded_feed_id_for_stride_zero(4), "4890"),
            (encoded_feed_id_for_stride_zero(5), "5abc"),
        ];
        let rb_indices_init = vec![
            (encoded_feed_id_for_stride_zero(1), 6),
            (encoded_feed_id_for_stride_zero(2), 5),
            (encoded_feed_id_for_stride_zero(3), 4),
            (encoded_feed_id_for_stride_zero(4), 3),
            (encoded_feed_id_for_stride_zero(5), 2),
        ];

        let config_init = default_config();
        let (updates, rb_indices, config) =
            setup_updates_rb_indices_and_config(&updates_init, &rb_indices_init, config_init);

        let expected_result = "000000050102400c0107123432676435730002400501022456000260040102367800028003010248900002a00201025abc010000000000000500040003000200000000000000000000000000000000000000000e80000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000";

        let mut feeds_rb_indexes = HashMap::new();

        let serialized = adfs_serialize_updates(
            net,
            &updates,
            Some(&rb_indices),
            config.clone(),
            &mut feeds_rb_indexes,
        )
        .await
        .unwrap();

        assert_eq!(expected_result, hex::encode(&serialized));

        let deserialized = adfs_deserialize_updates(&serialized).unwrap();
        assert_deserialized_updates(&updates, &config, &rb_indices, &deserialized);

        // Call as it will be in the reporter (feeds_rb_indexes provided by the sequencer)
        assert_eq!(
            expected_result,
            hex::encode(
                adfs_serialize_updates(net, &updates, None, config, &mut feeds_rb_indexes,)
                    .await
                    .unwrap()
            )
        );
    }

    #[tokio::test]
    async fn test_adfs_serialize_with_non_zero_counter_in_neighbour() {
        let net = "ETH";

        let updates_init = vec![
            (encoded_feed_id_for_stride_zero(1), "12343267643573"),
            (encoded_feed_id_for_stride_zero(2), "2456"),
            (encoded_feed_id_for_stride_zero(3), "3678"),
            (encoded_feed_id_for_stride_zero(4), "4890"),
            (encoded_feed_id_for_stride_zero(5), "5abc"),
        ];
        let rb_indices_init = vec![
            (encoded_feed_id_for_stride_zero(1), 6),
            (encoded_feed_id_for_stride_zero(2), 5),
            (encoded_feed_id_for_stride_zero(3), 4),
            (encoded_feed_id_for_stride_zero(4), 3),
            (encoded_feed_id_for_stride_zero(5), 2),
        ];

        let config_init = default_config();
        let (updates, mut rb_indices, config) =
            setup_updates_rb_indices_and_config(&updates_init, &rb_indices_init, config_init);
        rb_indices.insert(encoded_feed_id_for_stride_zero(6), 5);

        let expected_result = "000000050102400c0107123432676435730002400501022456000260040102367800028003010248900002a00201025abc010000000000000500040003000200040000000000000000000000000000000000000e80000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000";

        let mut feeds_rb_indexes = HashMap::new();

        let serialized = adfs_serialize_updates(
            net,
            &updates,
            Some(&rb_indices),
            config.clone(),
            &mut feeds_rb_indexes,
        )
        .await
        .unwrap();

        assert_eq!(expected_result, hex::encode(&serialized));

        let deserialized = adfs_deserialize_updates(&serialized).unwrap();
        assert_deserialized_updates(&updates, &config, &rb_indices, &deserialized);

        // Call as it will be in the reporter (feeds_rb_indexes provided by the sequencer)
        assert_eq!(
            expected_result,
            hex::encode(
                adfs_serialize_updates(net, &updates, None, config, &mut feeds_rb_indexes,)
                    .await
                    .unwrap()
            )
        );
    }

    #[tokio::test]
    async fn test_adfs_serialize_with_wrap_around_index() {
        let net = "ETH";

        let updates_init = vec![
            (encoded_feed_id_for_stride_zero(1), "12343267643573"),
            (encoded_feed_id_for_stride_zero(2), "2456"),
            (encoded_feed_id_for_stride_zero(3), "3678"),
            (encoded_feed_id_for_stride_zero(4), "4890"),
            (encoded_feed_id_for_stride_zero(5), "5abc"),
        ];
        let rb_indices_init = vec![
            (encoded_feed_id_for_stride_zero(1), 6),
            (encoded_feed_id_for_stride_zero(2), 5),
            (encoded_feed_id_for_stride_zero(3), 4),
            (encoded_feed_id_for_stride_zero(4), 9000),
            (encoded_feed_id_for_stride_zero(5), 2),
        ];

        let config_init = default_config();
        let (updates, mut rb_indices, config) =
            setup_updates_rb_indices_and_config(&updates_init, &rb_indices_init, config_init);
        rb_indices.insert(encoded_feed_id_for_stride_zero(6), 5);

        let expected_result = "000000050102400c0107123432676435730002400501022456000260040102367800028328010248900002a00201025abc010000000000000500040328000200040000000000000000000000000000000000000e80000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000";

        let mut batch_rb_indices = HashMap::new();

        let serialized = adfs_serialize_updates(
            net,
            &updates,
            Some(&rb_indices),
            config.clone(),
            &mut batch_rb_indices,
        )
        .await
        .unwrap();

        assert_eq!(expected_result, hex::encode(&serialized));

        let deserialized = adfs_deserialize_updates(&serialized).unwrap();
        assert_deserialized_updates(&updates, &config, &rb_indices, &deserialized);

        // Call as it will be in the reporter (rb_indices provided by the sequencer)
        assert_eq!(
            expected_result,
            hex::encode(
                adfs_serialize_updates(net, &updates, None, config, &mut rb_indices,)
                    .await
                    .unwrap()
            )
        );
    }
}
