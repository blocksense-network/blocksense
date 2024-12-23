use actix_web::web::Data;
use alloy::hex;
use blockchain_data_model::{BlockFeedConfig, BlockHeader, FeedActions, Resources};
use feed_registry::feed_registration_cmds::{
    DeleteAssetFeed, FeedsManagementCmds, RegisterNewAssetFeed,
};
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::message::{BorrowedMessage, Message};
use std::collections::HashMap;
use std::io::Error;
use std::time::SystemTime;
use tokio_stream::StreamExt;
use tracing::{debug, error, info, warn};

use crate::sequencer_state::SequencerState;

pub async fn blocks_reader_loop(
    sequencer_state: Data<SequencerState>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("blocks_reader_loop")
        .spawn_local(async move {
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

            loop {
                if let Some(message_result) = message_stream.next().await {
                    match message_result {
                        Ok(message) => {
                            process_msg_from_stream(sequencer_id, &sequencer_state, message).await;
                        }
                        Err(err) => {
                            // Handle message errors
                            error!("Error while consuming: {:?}", err);
                        }
                    }
                }
            }
        })
        .expect("Failed to spawn blocks_reader_loop!")
}

async fn process_msg_from_stream(
    sequencer_id: u64,
    sequencer_state: &Data<SequencerState>,
    message: BorrowedMessage<'_>,
) {
    // Process the message
    if let Some(payload) = message.payload() {
        debug!(
            "Processing Kafka message: Key: {:?}, Payload: {}, Offset: {}, Partition: {}",
            message.key(),
            String::from_utf8_lossy(payload),
            message.offset(),
            message.partition()
        );
        match serde_json::from_str::<serde_json::Value>(&String::from_utf8_lossy(payload)) {
            Ok(block) => {
                process_block(sequencer_id, sequencer_state, block).await;
            }
            Err(e) => {
                warn!("Error parsing block: {e}");
            }
        };
    }
}

async fn process_block(
    sequencer_id: u64,
    sequencer_state: &Data<SequencerState>,
    block: serde_json::Value,
) {
    match block["BlockHeader"].as_str() {
        Some(header) => {
            match hex::decode(header) {
                Ok(bytes) => {
                    let header = BlockHeader::deserialize(&bytes);
                    // A sequencer needs to process blocks that come from peer sequencers
                    // and all the blocks that it has emitted with block height
                    // higher than what it has in storage. A scenario of a sequencer
                    // having in storage a lower block height compared to the messages
                    // it has posted to the message queue are on restart, since we don't
                    // yet have persistent storage.
                    let process_block = header.issuer_id != sequencer_id
                        || sequencer_state
                            .blockchain_db
                            .read()
                            .await
                            .get_latest_block_height()
                            < header.block_height;
                    if process_block {
                        if let Some(add_remove_feeds) = block["FeedActions"].as_str() {
                            if let Ok(bytes) = hex::decode(add_remove_feeds) {
                                let add_remove_feeds = FeedActions::deserialize(&bytes);
                                for new_block_feed in
                                    add_remove_feeds.new_feeds.into_iter().flatten()
                                {
                                    let new_feed_config =
                                        block_feed_to_feed_config(&new_block_feed);
                                    info!("new_feed_config = {:?}", new_feed_config);
                                    let cmd = FeedsManagementCmds::RegisterNewAssetFeed(
                                        RegisterNewAssetFeed {
                                            config: new_feed_config.clone(),
                                        },
                                    );
                                    match sequencer_state.feeds_slots_manager_cmd_send.send(cmd) {
                                        Ok(_) => info!("forward register cmd"),
                                        Err(e) => {
                                            error!("Could not forward register cmd: {e}")
                                        }
                                    };
                                }
                                for rm_feed_id in
                                    add_remove_feeds.feed_ids_to_rm.into_iter().flatten()
                                {
                                    info!("rm_feed_id = {:?}", rm_feed_id);
                                    let cmd =
                                        FeedsManagementCmds::DeleteAssetFeed(DeleteAssetFeed {
                                            id: rm_feed_id,
                                        });
                                    match sequencer_state.feeds_slots_manager_cmd_send.send(cmd) {
                                        Ok(_) => info!("forward remove cmd"),
                                        Err(e) => {
                                            error!("Could not forward remove cmd: {e}")
                                        }
                                    };
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    error!("Decoding header: {header} failed! {e}");
                }
            }
        }
        None => {
            warn!("Recvd msg with missing BlockHeader! {block}");
        }
    }
}

// Functions for conversion of BlockFeedConfig to FeedConfig:
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
        always_publish_heartbeat_ms: block_feed.always_publish_heartbeat_ms,
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
    SystemTime::UNIX_EPOCH + std::time::Duration::from_millis(timestamp as u64)
}

fn u8_array_to_f32(bytes: [u8; 4]) -> f32 {
    f32::from_be_bytes(bytes)
}
