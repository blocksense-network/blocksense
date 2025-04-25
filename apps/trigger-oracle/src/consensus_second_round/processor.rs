use std::collections::HashMap;

use blocksense_config::FeedStrideAndDecimals;
use blocksense_feeds_processing::utils::validate;
use blocksense_gnosis_safe::{
    data_types::{ConsensusSecondRoundBatch, ReporterResponse},
    utils::{bytes_to_hex_string, create_private_key_signer, hex_str_to_bytes32, sign_hash},
};
use blocksense_metrics::metrics::REPORTER_FAILED_SEQ_REQUESTS;
use tokio::sync::mpsc::UnboundedReceiver;
use url::Url;

use crate::{DataFeedResults, TerminationReason};

pub async fn process(
    mut receiver: UnboundedReceiver<ConsensusSecondRoundBatch>,
    feeds_config: HashMap<u32, FeedStrideAndDecimals>,
    latest_votes: DataFeedResults,
    sequencer_endpoint: Url,
    second_consensus_secret_key: String,
    reporter_id: u64,
) -> TerminationReason {
    while let Some(aggregated_consensus) = receiver.recv().await {
        let signer = create_private_key_signer(&second_consensus_secret_key);

        let tx = match hex_str_to_bytes32(aggregated_consensus.tx_hash.as_str()) {
            Ok(t) => t,
            Err(e) => {
                tracing::error!("Failed to parse str to bytes on second consensus: {}", &e);
                continue;
            }
        };

        let block_height = aggregated_consensus.block_height;
        let network = aggregated_consensus.network.clone();

        match validate(
            feeds_config.clone(),
            aggregated_consensus,
            latest_votes.read().await.clone(),
            HashMap::new(),
        )
        .await
        {
            Ok(_) => {
                tracing::info!("Validated batch to post to contract: block_height={block_height}");
            }
            Err(e) => {
                tracing::error!(
                    "Failed to validate second consensus for block_height={block_height}: {}",
                    &e
                );
                continue;
            }
        };

        let signed = match sign_hash(&signer, &tx).await {
            Ok(s) => s,
            Err(e) => {
                tracing::error!("Failed to sign hash on second consensus: {}", &e);
                continue;
            }
        };

        let signature = bytes_to_hex_string(signed.signature);
        let report = ReporterResponse {
            block_height,
            reporter_id,
            network,
            signature,
        };

        tracing::trace!(
            "Sending to url - {}; {:?} hash",
            sequencer_endpoint.clone(),
            &report
        );

        let client = reqwest::Client::new();
        match client
            .post(sequencer_endpoint.clone())
            .json(&report)
            .send()
            .await
        {
            Ok(res) => {
                let contents = res.text().await.unwrap();
                tracing::trace!("Sequencer responded with: {}", &contents);
            }
            Err(e) => {
                //TODO(adikov): Add code from the error - e.status()
                REPORTER_FAILED_SEQ_REQUESTS
                    .with_label_values(&["404"])
                    .inc();

                tracing::error!("Sequencer failed to respond with: {}", &e);
            }
        };
    }
    TerminationReason::SequencerExitRequested
}
