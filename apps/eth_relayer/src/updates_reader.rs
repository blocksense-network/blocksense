use std::io::Error;

use alloy_primitives::map::HashMap;
use blocksense_config::AllFeedsConfig;
use blocksense_data_feeds::feeds_processing::{
    BatchedAggregatesToSend, EncodedBatchedAggregatesToSend, VotedFeedUpdate,
};
use blocksense_feed_registry::types::FeedType;
use blocksense_registry::config::FeedConfig;
use blocksense_utils::FeedId;
use futures::StreamExt;
use rdkafka::consumer::Consumer;
use rdkafka::Message;

use rdkafka::{consumer::StreamConsumer, message::BorrowedMessage, ClientConfig};
use tracing::{debug, error, info, warn};

pub async fn updates_reader_loop(
    feeds_config: AllFeedsConfig,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("updates_reader_loop")
        .spawn(async move {
            let kafka_report_endpoint = "127.0.0.1:9092";

            let active_feeds: HashMap<FeedId, FeedConfig> = feeds_config
                .feeds
                .into_iter()
                .map(|feed| (feed.id, feed))
                .collect();

            // Configure the Kafka consumer
            let consumer: StreamConsumer = ClientConfig::new()
                .set("bootstrap.servers", kafka_report_endpoint)
                .set("group.id", "eth_relayer_group") // Consumer group ID
                .set("enable.auto.commit", "false") // Disable auto-commit
                .set("auto.offset.reset", "earliest") // Start from the beginning if no offset is stored
                .set("debug", "all")
                .create()
                .expect("Failed to create Kafka consumer");

            // Subscribe to the desired topic(s)
            consumer
                .subscribe(&["aggregated_updates"])
                .expect("Failed to subscribe to topic");

            // Asynchronously process messages using a stream
            let mut message_stream = consumer.stream();

            loop {
                if let Some(message_result) = message_stream.next().await {
                    match message_result {
                        Ok(message) => {
                            process_msg_from_stream(&active_feeds, message).await;
                        }
                        Err(err) => {
                            // Handle message errors
                            error!("Error while consuming: {:?}", err);
                        }
                    }
                }
            }
        })
        .expect("Failed to spawn updates_reader_loop!")
}

async fn process_msg_from_stream(
    active_feeds: &HashMap<FeedId, FeedConfig>,
    message: BorrowedMessage<'_>,
) {
    // Process the message
    if let Some(payload) = message.payload() {
        info!(
            "Processing Kafka message: Key: {:?}, Payload: {}, Offset: {}, Partition: {}",
            message.key(),
            String::from_utf8_lossy(payload),
            message.offset(),
            message.partition()
        );

        match serde_json::from_str::<EncodedBatchedAggregatesToSend>(&String::from_utf8_lossy(
            payload,
        )) {
            Ok(encoded_updates) => {
                debug!("encoded_updates = {encoded_updates:?}");
                let updates = BatchedAggregatesToSend {
                    block_height: encoded_updates.block_height,
                    updates: {
                        let mut voted_feed_updates = Vec::new();
                        for v in &encoded_updates.updates {
                            let feed_id = v.feed_id;
                            let end_slot_timestamp = v.end_slot_timestamp;
                            debug!("Acquiring a read lock on feeds_config; feed_id={feed_id}");
                            let Some(feed_config) = active_feeds.get(&feed_id).cloned() else {
                                continue;
                            };
                            voted_feed_updates.push(VotedFeedUpdate {
                                feed_id,
                                value: match FeedType::from_bytes(
                                    v.value.clone(),
                                    {
                                        FeedType::get_variant_from_string(feed_config.value_type.as_str()).unwrap()
                                    },
                                    feed_config.additional_feed_info.decimals as usize
                                ) {
                                    Ok(v) => v,
                                    Err(e) => {
                                        error!("Could not deserialize value for feed_id: {}, bytes: {:?}, end_slot_timestamp: {} due to error: {}",
                                            feed_id,
                                            v.value,
                                            end_slot_timestamp,
                                            e,
                                        );
                                        continue;
                                    }
                                },
                                end_slot_timestamp,
                            });
                        }
                        voted_feed_updates
                    },
                };
                info!("updates = {updates:?}");
            }
            Err(e) => {
                warn!("Error parsing updates: {e}");
            }
        };
    }
}
