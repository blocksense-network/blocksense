use std::time::Duration;

use blocksense_gnosis_safe::data_types::ConsensusSecondRoundBatch;
use rdkafka::{
    consumer::{Consumer, StreamConsumer},
    ClientConfig, Message,
};
use tokio::{sync::mpsc::UnboundedSender, time::sleep};
use tokio_stream::StreamExt;

use crate::TerminationReason;

const TIME_BEFORE_KAFKA_READ_RETRY_IN_MS: u64 = 500;
const TOTAL_RETRIES_FOR_KAFKA_READ: u64 = 10;

pub async fn listen(
    kafka_report_endpoint: String,
    signal_sender: UnboundedSender<ConsensusSecondRoundBatch>,
) -> TerminationReason {
    // Configure the Kafka consumer
    let consumer: StreamConsumer = match ClientConfig::new()
        .set("bootstrap.servers", kafka_report_endpoint)
        .set("group.id", "no_commit_group") // Consumer group ID
        .set("enable.auto.commit", "false") // Disable auto-commit
        .set("auto.offset.reset", "latest") // Start from latest always
        .set("socket.timeout.ms", "300000")
        .set("session.timeout.ms", "400000")
        .set("max.poll.interval.ms", "500000")
        .create()
    {
        Ok(consumer) => consumer,
        Err(err) => {
            tracing::error!("Error while creating kafka consumer: {:?}", err);
            return TerminationReason::Other(format!(
                "Error while creating kafka consumer: {:?}",
                err
            ));
        }
    };

    // Subscribe to the desired topic(s)
    if let Err(err) = consumer.subscribe(&["aggregation_consensus"]) {
        return TerminationReason::Other(format!(
            "Error while subscribing to kafka topic: {:?}",
            err
        ));
    };

    // Asynchronously process messages using a stream
    let mut message_stream = consumer.stream();
    let mut total_err_messages = 0;

    while let Some(message_result) = message_stream.next().await {
        match message_result {
            Ok(message) => {
                total_err_messages = 0;
                let payload: ConsensusSecondRoundBatch = match message.payload() {
                    None => {
                        tracing::warn!("kafka None message received");
                        continue;
                    }
                    Some(bytes) => match serde_json::from_slice(bytes) {
                        Ok(r) => r,
                        Err(err) => {
                            tracing::error!("Error while parsing the message: {:?}", err);
                            continue;
                        }
                    },
                };
                tracing::debug!("kafka message received - {:?}", payload);

                match signal_sender.send(payload) {
                    Ok(_) => {
                        continue;
                    }
                    Err(_) => {
                        break;
                    }
                };
            }
            Err(err) => {
                // Handle message errors
                tracing::error!("Error while consuming: {:?}", err);
                total_err_messages += 1;
                if total_err_messages >= TOTAL_RETRIES_FOR_KAFKA_READ {
                    return TerminationReason::Other(format!("Error while consuming: {:?}", err));
                }
                let _ = sleep(Duration::from_millis(TIME_BEFORE_KAFKA_READ_RETRY_IN_MS)).await;
                continue;
            }
        }
    }

    TerminationReason::Other("Signal secondary consensus loop terminated".to_string())
}
