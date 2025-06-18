use actix_web::web::Data;
use alloy::hex;
use blocksense_blockchain_data_model::{BlockHeader, FeedActions};
use blocksense_feed_registry::feed_registration_cmds::{
    DeleteAssetFeed, FeedsManagementCmds, RegisterNewAssetFeed,
};
use eyre::Result;
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::message::{BorrowedMessage, Message};
use std::io::Error;
use tokio_stream::StreamExt;
use tracing::{debug, error, info, warn};

use crate::feeds::feed_config_conversions::block_feed_to_feed_config;
use crate::sequencer_state::SequencerState;

pub async fn blocks_reader_loop(
    sequencer_state: Data<SequencerState>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("blocks_reader_loop")
        .spawn(async move {
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
                match process_block(sequencer_id, sequencer_state, &block).await {
                    Ok(_) => debug!("Successfully processed block: {block}"),
                    Err(e) => error!("Error processing block: {block} error: {e}"),
                };
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
    block: &serde_json::Value,
) -> Result<()> {
    match block["BlockHeader"].as_str() {
        Some(header) => {
            match hex::decode(header) {
                Ok(bytes) => {
                    let header = match BlockHeader::deserialize(&bytes) {
                        Ok(h) => h,
                        Err(e) => eyre::bail!("BlockHeader::deserialize error: {e}"),
                    };
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
                        if let Some(feed_actions) = block["FeedActions"].as_str() {
                            if let Ok(bytes) = hex::decode(feed_actions) {
                                let feed_actions = match FeedActions::deserialize(&bytes) {
                                    Ok(fa) => fa,
                                    Err(e) => eyre::bail!("FeedActions::deserialize error: {e}"),
                                };
                                for new_block_feed in feed_actions.new_feeds.into_iter().flatten() {
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
                                for rm_feed_id in feed_actions.feed_ids_to_rm.into_iter().flatten()
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
    Ok(())
}
