use std::collections::HashMap;

use blocksense_crypto::JsonSerializableSignature;
use blocksense_data_feeds::{
    feeds_processing::VotedFeedUpdate, generate_signature::generate_signature,
};
use blocksense_feed_registry::types::{DataFeedPayload, FeedError, FeedType, PayloadMetaData};
use blocksense_metrics::metrics::REPORTER_FAILED_SEQ_REQUESTS;
use blocksense_utils::time::current_unix_time;
use tokio::sync::mpsc::UnboundedReceiver;
use url::Url;

use crate::{DataFeedResults, Payload};

pub async fn process_payload(
    mut rx: UnboundedReceiver<(String, Payload)>,
    latest_votes: DataFeedResults,
    sequencer_url: Url,
    secret_key: String,
    reporter_id: u64,
) {
    tracing::trace!("Task sender to sequencer started");
    while let Some((_component_id, payload)) = rx.recv().await {
        tracing::trace!(
            "Sender to sequencer received payload of size {}",
            payload.values.len()
        );
        let timestamp = current_unix_time();
        let mut batch_payload = vec![];
        for crate::oracle::DataFeedResult { id, value } in payload.values {
            let result = match value {
                crate::oracle::DataFeedResultValue::Numerical(value) => {
                    Ok(FeedType::Numerical(value))
                }
                crate::oracle::DataFeedResultValue::Text(value) => Ok(FeedType::Text(value)),
                crate::oracle::DataFeedResultValue::Error(error_string) => {
                    Err(FeedError::APIError(error_string))
                }
                crate::oracle::DataFeedResultValue::None => {
                    tracing::warn!("Encountered None result for feed id {id}");
                    //TODO(adikov): Handle properly None result
                    continue;
                }
            };

            let signature =
                generate_signature(&secret_key, id.as_str(), timestamp, &result).unwrap();

            batch_payload.push(DataFeedPayload {
                payload_metadata: PayloadMetaData {
                    reporter_id,
                    feed_id: id,
                    timestamp,
                    signature: JsonSerializableSignature { sig: signature },
                },
                result,
            });
        }
        //TODO(adikov): Potential better implementation would be to send results to the
        //sequencer every few seconds in which we can gather batches of data feed payloads.

        tracing::trace!(
            "Sending to url - {}; {} batches",
            sequencer_url.clone(),
            batch_payload.len()
        );
        let client = reqwest::Client::new();
        match client
            .post(sequencer_url.clone())
            .json(&batch_payload)
            .send()
            .await
        {
            Ok(res) => {
                let status = res.status();
                let contents = res.text().await.unwrap();
                tracing::trace!("Sequencer responded with status={status} and text={contents}");

                let mut latest_votes = latest_votes.write().await;
                update_latest_votes(&mut latest_votes, batch_payload);
            }
            Err(e) => {
                //TODO(adikov): Add code from the error - e.status()
                REPORTER_FAILED_SEQ_REQUESTS
                    .with_label_values(&["404"])
                    .inc();

                tracing::error!("Sequencer failed to respond with; err={e}");
            }
        };
        tracing::trace!("Sender to sequencer waiting for new payload...");
    }

    tracing::trace!("Task sender to sequencer ending");
}

fn update_latest_votes(
    latest_votes: &mut HashMap<u32, VotedFeedUpdate>,
    batch: Vec<DataFeedPayload>,
) {
    for vote in batch {
        let feed_id = vote.payload_metadata.feed_id.parse().unwrap();

        if let Ok(value) = vote.result {
            _ = latest_votes.insert(
                feed_id,
                VotedFeedUpdate {
                    feed_id,
                    value,
                    end_slot_timestamp: vote.payload_metadata.timestamp,
                },
            );
        }
    }
}
