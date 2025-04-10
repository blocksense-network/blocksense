use blocksense_blockchain_data_model::{BlockFeedConfig, DataChunk, Resources, DATA_CHUNK_SIZE};
use blocksense_registry::config::{AssetPair, FeedConfig, FeedQuorum, FeedSchedule, PriceFeedInfo};

use anyhow::Result;
use serde_json::Value;

// Functions for conversion of FeedConfig to BlockFeedConfig:

pub fn feed_config_to_block(feed_config: &FeedConfig) -> BlockFeedConfig {
    BlockFeedConfig {
        id: feed_config.id,
        name: string_to_data_chunk(&feed_config.full_name),
        full_name: string_to_data_chunk(&feed_config.full_name),
        description: string_to_data_chunk(&feed_config.description),
        _type: string_to_data_chunk(&feed_config.feed_type),
        decimals: feed_config.additional_feed_info.decimals,
        pair: blocksense_blockchain_data_model::AssetPair {
            base: string_to_data_chunk(feed_config.additional_feed_info.pair.base.as_str()),
            quote: string_to_data_chunk(feed_config.additional_feed_info.pair.quote.as_str()),
        },
        report_interval_ms: feed_config.schedule.interval_ms,
        first_report_start_time: feed_config.schedule.first_report_start_unix_time_ms,
        resources: json_to_byte_arrays(&feed_config.additional_feed_info.arguments)
            .expect("Can't parse arguments to bytes"),
        quorum_percentage: f32_to_u8_array(feed_config.quorum.percentage),
        skip_publish_if_less_then_percentage: f32_to_u8_array(
            feed_config.schedule.deviation_percentage,
        ),
        always_publish_heartbeat_ms: feed_config.schedule.heartbeat_ms,
        script: string_to_data_chunk(&feed_config.oracle_id),
        value_type: string_to_data_chunk(&feed_config.value_type),
        aggregate_type: string_to_data_chunk(&feed_config.quorum.aggregation),
        stride: feed_config.stride,
    }
}

// Helper function to convert f32 to [u8; 4]
fn f32_to_u8_array(value: f32) -> [u8; 4] {
    value.to_be_bytes()
}

// Helper function to convert String to DataChunk ([u8; 32])
fn string_to_data_chunk(input: &str) -> DataChunk {
    let mut chunk = [0u8; 32];
    let bytes = input.as_bytes();
    let len = bytes.len().min(32); // Truncate if longer than 32 bytes
    chunk[..len].copy_from_slice(&bytes[..len]);
    chunk
}

fn json_to_byte_arrays(json: &Value) -> Result<Resources> {
    let mut bytes = Vec::new();
    serde_json::to_writer(&mut bytes, json)?;

    let mut result: Resources = [None; DATA_CHUNK_SIZE];
    for (i, chunk) in bytes.chunks(DATA_CHUNK_SIZE).enumerate() {
        if i >= DATA_CHUNK_SIZE {
            anyhow::bail!(
                "Byte vector exceeds maximum size of {} chunks",
                DATA_CHUNK_SIZE
            );
        }

        let mut array = [0u8; DATA_CHUNK_SIZE];
        array.copy_from_slice(chunk);
        result[i] = Some(array);
    }

    Ok(result)
}

fn byte_arrays_to_json(byte_arrays: &Resources) -> Result<Value> {
    let bytes: Vec<u8> = byte_arrays
        .iter()
        .filter_map(|opt| *opt)
        .flatten()
        .collect();
    Ok(serde_json::from_slice(&bytes)?)
}

//TODO(adikov): Properly transform BlockFeedConfig to the new FeedConfig
// Functions for conversion of BlockFeedConfig to FeedConfig:
pub fn block_feed_to_feed_config(block_feed: &BlockFeedConfig) -> FeedConfig {
    FeedConfig {
        id: block_feed.id,
        full_name: data_chunk_to_string(&block_feed.full_name),
        description: data_chunk_to_string(&block_feed.description),
        feed_type: data_chunk_to_string(&block_feed._type),
        oracle_id: data_chunk_to_string(&block_feed.script),
        value_type: data_chunk_to_string(&block_feed.value_type),
        stride: block_feed.stride,
        quorum: FeedQuorum {
            percentage: u8_array_to_f32(block_feed.quorum_percentage),
            aggregation: data_chunk_to_string(&block_feed.aggregate_type),
        },
        schedule: FeedSchedule {
            interval_ms: block_feed.report_interval_ms,
            heartbeat_ms: block_feed.always_publish_heartbeat_ms,
            deviation_percentage: u8_array_to_f32(block_feed.skip_publish_if_less_then_percentage),
            first_report_start_unix_time_ms: block_feed.first_report_start_time,
        },
        additional_feed_info: PriceFeedInfo {
            pair: AssetPair {
                base: data_chunk_to_string(&block_feed.pair.base),
                quote: data_chunk_to_string(&block_feed.pair.quote),
            },
            decimals: block_feed.decimals,
            category: "".to_string(),
            market_hours: None,
            //TODO(adikov): start handling errors properly
            arguments: byte_arrays_to_json(&block_feed.resources)
                .expect("Can't parse arguments to bytes"),
        },
        compatibility_info: None,
    }
}

fn data_chunk_to_string(bytes: &DataChunk) -> String {
    let null_terminated = bytes.split(|&b| b == 0).next().unwrap_or(&[]);
    String::from_utf8(null_terminated.to_vec()).unwrap_or_default()
}

fn u8_array_to_f32(bytes: [u8; 4]) -> f32 {
    f32::from_be_bytes(bytes)
}
