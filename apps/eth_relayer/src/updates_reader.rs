use std::io::Error;

use futures::StreamExt;
use rdkafka::consumer::Consumer;
use rdkafka::Message;

use rdkafka::{consumer::StreamConsumer, message::BorrowedMessage, ClientConfig};
use tracing::{debug, error, info, warn};

pub async fn updates_reader_loop() -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("updates_reader_loop")
        .spawn(async move {
            let kafka_report_endpoint = "127.0.0.1:9092";

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
                            process_msg_from_stream(message).await;
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

async fn process_msg_from_stream(message: BorrowedMessage<'_>) {
    // Process the message
    if let Some(payload) = message.payload() {
        info!(
            "Processing Kafka message: Key: {:?}, Payload: {}, Offset: {}, Partition: {}",
            message.key(),
            String::from_utf8_lossy(payload),
            message.offset(),
            message.partition()
        );
        match serde_json::from_str::<serde_json::Value>(&String::from_utf8_lossy(payload)) {
            Ok(updates) => {
                debug!("Updates = {updates:?}");
            }
            Err(e) => {
                warn!("Error parsing updates: {e}");
            }
        };
    }
}
