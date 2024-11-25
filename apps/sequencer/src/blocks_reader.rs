use actix_web::rt::spawn;
use actix_web::web::Data;
use alloy::hex;
use blockchain_data_model::{BlockFeedConfig, BlockHeader, FeedActions, Resources};
use feed_registry::feed_registration_cmds::{
    DeleteAssetFeed, FeedsManagementCmds, RegisterNewAssetFeed,
};
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::message::Message;
use std::collections::HashMap;
use std::io::Error;
use std::time::SystemTime;
use tokio_stream::StreamExt;
use tracing::{error, info, warn};

use crate::sequencer_state::SequencerState;

pub async fn blocks_reader_loop(
    sequencer_state: Data<SequencerState>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    spawn(async move {
        let Some(kafka_report_endpoint) = sequencer_state
            .sequencer_config
            .read()
            .await
            .kafka_report_endpoint
            .url
            .clone()
        else {
            warn!("No kafka endpoint specified for reading blocks!");
            return Ok(()); // Exit the function early
        };

        // Configure the Kafka consumer
        let consumer: StreamConsumer = ClientConfig::new()
            .set("bootstrap.servers", kafka_report_endpoint)
            .set("group.id", "no_commit_group") // Consumer group ID
            .set("enable.auto.commit", "false") // Disable auto-commit
            .set("auto.offset.reset", "earliest") // Start from the beginning if no offset is stored
            .create()
            .expect("Failed to create Kafka consumer");

        // Subscribe to the desired topic(s)
        consumer
            .subscribe(&["blockchain"])
            .expect("Failed to subscribe to topic");

        // Asynchronously process messages using a stream
        let mut message_stream = consumer.stream();

        let sequencer_id = sequencer_state.sequencer_config.read().await.sequencer_id;
        let db = sequencer_state.blockchain_db.clone();

        loop {
            if let Some(message_result) = message_stream.next().await {
                match message_result {
                    Ok(message) => {
                        // Process the message
                        if let Some(payload) = message.payload() {
                            info!(
                                "Key: {:?}, Payload: {}, Offset: {}, Partition: {}",
                                message.key(),
                                String::from_utf8_lossy(payload),
                                message.offset(),
                                message.partition()
                            );
                            match serde_json::from_str::<serde_json::Value>(
                                &String::from_utf8_lossy(payload),
                            ) {
                                Ok(val) => {
                                    if let Some(header) = val["BlockHeader"].as_str() {
                                        if let Ok(bytes) = hex::decode(header) {
                                            let header = BlockHeader::deserialize(&bytes);
                                            let process_block = header.issuer_id != sequencer_id
                                                || (header.issuer_id == sequencer_id
                                                    && db.read().await.get_latest_block_height()
                                                        < header.block_height);
                                            if process_block {
                                                if let Some(add_remove_feeds) =
                                                    val["FeedActions"].as_str()
                                                {
                                                    if let Ok(bytes) = hex::decode(add_remove_feeds)
                                                    {
                                                        let add_remove_feeds =
                                                            FeedActions::deserialize(&bytes);
                                                        for new_feed in add_remove_feeds.new_feeds {
                                                            if let Some(new_block_feed) = new_feed {
                                                                let new_feed_config =
                                                                    block_feed_to_feed_config(
                                                                        &new_block_feed,
                                                                    );
                                                                info!(
                                                                    "new_feed_config = {:?}",
                                                                    new_feed_config
                                                                );
                                                            }
                                                        }
                                                        for rm_feed_id in
                                                            add_remove_feeds.feed_ids_to_rm
                                                        {
                                                            if let Some(rm_feed_id) = rm_feed_id {}
                                                        }
                                                    }
                                                }
                                            }
                                        } else {
                                            info!("Decoding failed!");
                                        }
                                    }
                                }
                                Err(e) => {
                                    warn!("Error parsing block: {e}");
                                }
                            };
                        }
                    }
                    Err(err) => {
                        // Handle message errors
                        error!("Error while consuming: {:?}", err);
                    }
                }
            }
        }
    })
}

fn block_feed_to_feed_config(block_feed: &BlockFeedConfig) -> config::FeedConfig {
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
        resources: convert_resources(&block_feed.resources),
        quorum_percentage: u8_array_to_f32(block_feed.quorum_percentage),
        skip_publish_if_less_then_percentage: u8_array_to_f32(
            block_feed.skip_publish_if_less_then_percentage,
        ),
        script: data_chunk_to_string(&block_feed.script),
        value_type: data_chunk_to_string(&block_feed.value_type),
        aggregate_type: data_chunk_to_string(&block_feed.aggregate_type),
    }
}

fn data_chunk_to_string(bytes: &[u8; 32]) -> String {
    let null_terminated = bytes.split(|&b| b == 0).next().unwrap_or(&[]);
    String::from_utf8(null_terminated.to_vec()).unwrap_or_default()
}

fn convert_resources(resources: &Resources) -> HashMap<String, String> {
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
    SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(timestamp)
}

fn u8_array_to_f32(bytes: [u8; 4]) -> f32 {
    f32::from_be_bytes(bytes)
}
