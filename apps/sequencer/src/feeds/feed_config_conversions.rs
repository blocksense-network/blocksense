use std::{
    collections::HashMap,
    time::{SystemTime, UNIX_EPOCH},
};

use blockchain_data_model::{BlockFeedConfig, DataChunk, Resources};

// Functions for conversion of FeedConfig to BlockFeedConfig:

pub fn feed_config_to_block(feed_config: &config::FeedConfig) -> BlockFeedConfig {
    BlockFeedConfig {
        id: feed_config.id,
        name: string_to_data_chunk(&feed_config.name),
        full_name: string_to_data_chunk(&feed_config.full_name),
        description: string_to_data_chunk(&feed_config.description),
        _type: string_to_data_chunk(&feed_config._type),
        decimals: feed_config.decimals,
        pair: blockchain_data_model::AssetPair {
            base: string_to_data_chunk(feed_config.pair.base.as_str()),
            quote: string_to_data_chunk(feed_config.pair.quote.as_str()),
        },
        report_interval_ms: feed_config.report_interval_ms,
        first_report_start_time: system_time_to_u64(feed_config.first_report_start_time),
        resources: convert_resources_from_cfg(&feed_config.resources),
        quorum_percentage: f32_to_u8_array(feed_config.quorum_percentage),
        skip_publish_if_less_then_percentage: f32_to_u8_array(
            feed_config.skip_publish_if_less_then_percentage,
        ),
        always_publish_heartbeat_ms: feed_config.always_publish_heartbeat_ms,
        script: string_to_data_chunk(&feed_config.script),
        value_type: string_to_data_chunk(&feed_config.value_type),
        aggregate_type: string_to_data_chunk(&feed_config.aggregate_type),
        stride: feed_config.stride,
    }
}

// Helper function to convert SystemTime to u64 (seconds since UNIX_EPOCH)
fn system_time_to_u64(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH)
        .expect("SystemTime should be after UNIX_EPOCH")
        .as_millis() as u64
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

// Function to convert HashMap<String, String> to Resources struct
fn convert_resources_from_cfg(map: &HashMap<String, String>) -> Resources {
    // Initialize arrays with None
    let mut resource_keys: [Option<DataChunk>; 32] = Default::default();
    let mut resource_values: [Option<DataChunk>; 32] = Default::default();

    // Iterate over the HashMap, up to 32 entries
    for (i, (key, value)) in map.iter().take(32).enumerate() {
        resource_keys[i] = Some(string_to_data_chunk(key));
        resource_values[i] = Some(string_to_data_chunk(value));
    }

    Resources {
        resource_keys,
        resource_values,
    }
}

// Functions for conversion of BlockFeedConfig to FeedConfig:

pub fn block_feed_to_feed_config(block_feed: &BlockFeedConfig) -> config::FeedConfig {
    config::FeedConfig {
        id: block_feed.id,
        name: data_chunk_to_string(&block_feed.name),
        full_name: data_chunk_to_string(&block_feed.full_name),
        description: data_chunk_to_string(&block_feed.description),
        _type: data_chunk_to_string(&block_feed._type),
        decimals: block_feed.decimals,
        pair: config::AssetPair {
            base: data_chunk_to_string(&block_feed.pair.base),
            quote: data_chunk_to_string(&block_feed.pair.quote),
        },
        report_interval_ms: block_feed.report_interval_ms,
        first_report_start_time: u64_to_system_time(block_feed.first_report_start_time),
        resources: convert_resources_from_block(&block_feed.resources),
        quorum_percentage: u8_array_to_f32(block_feed.quorum_percentage),
        skip_publish_if_less_then_percentage: u8_array_to_f32(
            block_feed.skip_publish_if_less_then_percentage,
        ),
        always_publish_heartbeat_ms: block_feed.always_publish_heartbeat_ms,
        script: data_chunk_to_string(&block_feed.script),
        value_type: data_chunk_to_string(&block_feed.value_type),
        aggregate_type: data_chunk_to_string(&block_feed.aggregate_type),
        stride: block_feed.stride,
    }
}

fn data_chunk_to_string(bytes: &[u8; 32]) -> String {
    let null_terminated = bytes.split(|&b| b == 0).next().unwrap_or(&[]);
    String::from_utf8(null_terminated.to_vec()).unwrap_or_default()
}

fn convert_resources_from_block(resources: &Resources) -> HashMap<String, String> {
    // Convert `Resources` back to `HashMap<String, String>` based on its internal representation
    let mut map = HashMap::new();

    for (key_opt, value_opt) in resources
        .resource_keys
        .iter()
        .zip(&resources.resource_values)
    {
        if let (Some(key), Some(value)) = (key_opt, value_opt) {
            // Convert DataChunk back to String and insert into HashMap
            map.insert(data_chunk_to_string(key), data_chunk_to_string(value));
        }
    }
    map
}

fn u64_to_system_time(timestamp: u64) -> SystemTime {
    SystemTime::UNIX_EPOCH + std::time::Duration::from_millis(timestamp)
}

fn u8_array_to_f32(bytes: [u8; 4]) -> f32 {
    f32::from_be_bytes(bytes)
}
