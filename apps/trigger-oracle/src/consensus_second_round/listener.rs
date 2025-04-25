use std::time::Duration;

use anyhow::Context;
use blocksense_gnosis_safe::data_types::ConsensusSecondRoundBatch;
use rdkafka::{
    consumer::{Consumer, DefaultConsumerContext, MessageStream, StreamConsumer},
    message::BorrowedMessage,
    ClientConfig, Message,
};
use tokio::{sync::mpsc::UnboundedSender, time::sleep};
use tokio_stream::StreamExt;

use crate::TerminationReason;

const TIME_BEFORE_KAFKA_READ_RETRY_IN_MS: u64 = 500;
const TOTAL_RETRIES_FOR_KAFKA_READ: u64 = 10;

pub async fn listen(
    kafka_report_endpoint: String,
    sender: UnboundedSender<ConsensusSecondRoundBatch>,
) -> TerminationReason {
    let consumer = match create_kafka_stream_consumer(&kafka_report_endpoint) {
        Ok(consumer) => consumer,
        Err(err) => return TerminationReason::Other(err.to_string()),
    };

    if let Err(err) = consumer.subscribe(&["aggregation_consensus"]) {
        return TerminationReason::Other(format!(
            "Error while subscribing to kafka topic: {:?}",
            err
        ));
    };

    return handle_messages_with_retry(
        consumer.stream(),
        sender,
        TOTAL_RETRIES_FOR_KAFKA_READ,
        Duration::from_millis(TIME_BEFORE_KAFKA_READ_RETRY_IN_MS),
    )
    .await;
}

async fn handle_message(
    message: BorrowedMessage<'_>,
    sender: &mut UnboundedSender<ConsensusSecondRoundBatch>,
) {
    match message.payload() {
        Some(bytes) => match serde_json::from_slice(bytes) {
            Ok(payload) => {
                tracing::debug!("kafka message received - {payload:?}");
                _ = sender.send(payload).inspect_err(|err| {
                    tracing::error!("Error while sending second consensus verification: {err:?}",)
                });
            }
            Err(err) => tracing::error!("Error while parsing the message: {err:?}"),
        },
        None => tracing::warn!("kafka None message received"),
    }
}

async fn handle_messages_with_retry(
    mut stream: MessageStream<'_, DefaultConsumerContext>,
    mut sender: UnboundedSender<ConsensusSecondRoundBatch>,
    retry_count: u64,
    sleep_duration: Duration,
) -> TerminationReason {
    let mut consecutive_errors_count = 0;

    while let Some(message_result) = stream.next().await {
        match message_result {
            Ok(message) => {
                consecutive_errors_count = 0;
                handle_message(message, &mut sender).await;
            }
            Err(err) => {
                tracing::error!("Error while consuming: {:?}", err);
                consecutive_errors_count += 1;
                if consecutive_errors_count >= retry_count {
                    return TerminationReason::Other(format!("Error while consuming: {:?}", err));
                }
                sleep(sleep_duration).await;
                continue;
            }
        }
    }

    TerminationReason::Other("Signal secondary consensus loop terminated".into())
}

fn create_kafka_stream_consumer(endpoint: &str) -> anyhow::Result<StreamConsumer> {
    ClientConfig::new()
        .set("bootstrap.servers", endpoint)
        .set("group.id", "no_commit_group") // Consumer group ID
        .set("enable.auto.commit", "false") // Disable auto-commit
        .set("auto.offset.reset", "latest") // Start from latest always
        .set("socket.timeout.ms", "300000")
        .set("session.timeout.ms", "400000")
        .set("max.poll.interval.ms", "500000")
        .create()
        .context("Could not create kafka stream consumer")
}
