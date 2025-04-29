use crate::adfs_gen_calldata::adfs_serialize_updates;
use alloy_primitives::{Address, Bytes, Uint, U256};
use anyhow::bail;
use anyhow::{anyhow, Context, Result};
use blocksense_anomaly_detection::ingest::anomaly_detector_aggregate;
use blocksense_config::{FeedStrideAndDecimals, PublishCriteria};
use blocksense_crypto::{verify_signature, PublicKey, Signature};
use blocksense_data_feeds::feeds_processing::{
    BatchedAggegratesToSend, DoSkipReason, DontSkipReason, SkipDecision, VotedFeedUpdate,
    VotedFeedUpdateWithProof,
};
use blocksense_feed_registry::{
    aggregate::FeedAggregate,
    registry::FeedAggregateHistory,
    types::{DataFeedPayload, FeedResult, FeedType, Timestamp},
};
use blocksense_gnosis_safe::{
    data_types::ConsensusSecondRoundBatch,
    utils::{create_safe_tx, generate_transaction_hash},
};
use itertools::Itertools;
use ringbuf::traits::consumer::Consumer;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

pub const AD_MIN_DATA_POINTS_THRESHOLD: usize = 100;

pub fn check_signature(
    signature: &Signature,
    pub_key: &PublicKey,
    feed_id: &str,
    timestamp: Timestamp,
    feed_result: &FeedResult,
) -> bool {
    let mut byte_buffer: Vec<u8> = feed_id
        .as_bytes()
        .iter()
        .copied()
        .chain(timestamp.to_be_bytes().to_vec())
        .collect();

    if let Ok(result) = feed_result {
        match result.as_bytes(18, timestamp as u64) {
            Ok(bytes) => {
                byte_buffer.extend(bytes);
            }
            Err(e) => {
                warn!("Could not convert vlaue of feed id {feed_id} to bytes: {e}");
            }
        };
    }
    verify_signature(pub_key, signature, &byte_buffer)
}

#[derive(Debug)]
pub struct ConsumedReports {
    pub is_quorum_reached: bool,
    pub skip_decision: SkipDecision,
    pub ad_score: Option<f64>,
    pub result_post_to_contract: Option<VotedFeedUpdateWithProof>,
    pub end_slot_timestamp: Timestamp,
}

#[allow(clippy::too_many_arguments)]
pub async fn consume_reports(
    name: &str,
    reports: &HashMap<u64, DataFeedPayload>,
    feed_type: &FeedType,
    slot: u64,
    quorum_percentage: f32,
    skip_publish_if_less_then_percentage: f64,
    always_publish_heartbeat_ms: Option<u128>,
    end_slot_timestamp: Timestamp,
    num_reporters: usize,
    is_oneshot: bool,
    aggregator: FeedAggregate,
    history: Option<Arc<RwLock<FeedAggregateHistory>>>,
    feed_id: u32,
) -> ConsumedReports {
    let values = collect_reported_values(feed_type, feed_id, reports, slot);

    if values.is_empty() {
        info!("No reports found for feed: {} slot: {}!", name, &slot);
        ConsumedReports {
            is_quorum_reached: false,
            skip_decision: SkipDecision::DoSkip(DoSkipReason::NothingToPost),
            ad_score: None,
            result_post_to_contract: None,
            end_slot_timestamp,
        }
    } else {
        let total_votes_count = values.len() as f32;
        let required_votes_count = quorum_percentage * 0.01f32 * (num_reporters as f32);
        let is_quorum_reached = required_votes_count <= total_votes_count;
        if !is_quorum_reached {
            warn!(
                "Insufficient quorum of reports to post to contract for feed: {} slot: {}! Expected at least a quorum of {}, but received {} out of {} valid votes.",
                name, &slot, quorum_percentage, total_votes_count, num_reporters
            );
        }

        // Dispatch to concrete FeedAggregate implementation.
        let result_post_to_contract = VotedFeedUpdate {
            feed_id,
            value: aggregator.aggregate(&values[..]), // Perform the concrete aggregation
            end_slot_timestamp,
        };

        let mut proof: Vec<DataFeedPayload> = Vec::new();
        for (_, v) in reports.iter() {
            proof.push(v.clone());
        }

        let mut ad_score_opt: Option<f64> = None;

        // Oneshot feeds have no history, so we cannot perform anomaly detection on them.
        let skip_decision = if !is_oneshot {
            if let Some(history) = history {
                if let FeedType::Numerical(candidate_value) = result_post_to_contract.value {
                    let ad_score =
                        perform_anomaly_detection(feed_id, history.clone(), candidate_value).await;
                    match ad_score {
                        Ok(ad_score) => {
                            info!(
                                "AD_score for {:?} is {}",
                                result_post_to_contract.value, ad_score
                            );
                            ad_score_opt = Some(ad_score)
                        }
                        Err(e) => {
                            warn!("Anomaly Detection failed with error - {}", e);
                        }
                    }
                    {
                        let criteria = PublishCriteria {
                            feed_id,
                            skip_publish_if_less_then_percentage,
                            always_publish_heartbeat_ms,
                            peg_to_value: None,
                            peg_tolerance_percentage: 0.0f64,
                        };
                        debug!("Get a read lock on history [feed {feed_id}]");
                        let history_guard = history.read().await;
                        let skip_decision =
                            result_post_to_contract.should_skip(&criteria, &history_guard);
                        debug!("Release the read lock on history [feed {feed_id}]");
                        skip_decision
                    }
                } else {
                    SkipDecision::DontSkip(DontSkipReason::NonNumericalFeed)
                }
            } else {
                SkipDecision::DontSkip(DontSkipReason::NoHistory)
            }
        } else {
            SkipDecision::DontSkip(DontSkipReason::OneShotFeed)
        };
        let res = ConsumedReports {
            is_quorum_reached,
            skip_decision,
            ad_score: ad_score_opt,
            result_post_to_contract: Some(VotedFeedUpdateWithProof {
                update: result_post_to_contract,
                proof,
            }),
            end_slot_timestamp,
        };
        info!("[feed {feed_id}] result_post_to_contract = {:?}", res);
        res
    }
}

pub fn collect_reported_values(
    expected_feed_type: &FeedType,
    feed_id: u32,
    reports: &HashMap<u64, DataFeedPayload>,
    slot: u64,
) -> Vec<FeedType> {
    let mut values: Vec<FeedType> = vec![];
    for kv in reports {
        match &kv.1.result {
            Ok(value) => {
                if value.same_enum_type_as(expected_feed_type) {
                    values.push(value.clone());
                } else {
                    warn!("Wrong value type reported by reporter {} for feed id {} slot {}! {} expected", kv.0, feed_id, slot, expected_feed_type.enum_type_to_string());
                }
            }
            Err(_) => {
                warn!(
                    "Got error from reporter {} for feed id {} slot {}",
                    kv.0, feed_id, slot
                );
            }
        }
    }
    values
}

pub async fn perform_anomaly_detection(
    feed_id: u32,
    history: Arc<RwLock<FeedAggregateHistory>>,
    candidate_value: f64,
) -> Result<f64, anyhow::Error> {
    let anomaly_detection_future = async move {
        debug!("Get a read lock on history [feed {feed_id}]");
        let history_lock = history.read().await;

        // The first slice is from the current read position to the end of the array
        // The second slice represents the segment from the start of the array up to the current write position if the buffer has wrapped around
        let heap = history_lock
            .get(feed_id)
            .context("Missing key from History!")?;
        let (first, last) = heap.as_slices();
        let history_vec: Vec<&FeedType> =
            first.iter().chain(last.iter()).map(|h| &h.value).collect();
        let mut numerical_vec: Vec<f64> = history_vec
            .iter()
            .filter_map(|feed| {
                if let FeedType::Numerical(value) = feed {
                    Some(*value)
                } else if let FeedType::Text(_) = feed {
                    warn!("Anomaly Detection not implemented for FeedType::Text, skipping...");
                    None
                } else {
                    warn!("Anomaly Detection does not recognize FeedType, skipping...");
                    None
                }
            })
            .collect();

        drop(history_lock);
        debug!("Release the read lock on history [feed {feed_id}]");

        numerical_vec.push(candidate_value);

        // Get AD prediction only if enough data is present
        if numerical_vec.len() > AD_MIN_DATA_POINTS_THRESHOLD {
            debug!("Starting anomaly detection for [feed {feed_id}]");
            anomaly_detector_aggregate(numerical_vec).map_err(|e| anyhow!("{e}"))
        } else {
            Err(anyhow!(
                "Skipping anomaly detection; numerical_vec.len() = {} threshold: {}",
                numerical_vec.len(),
                AD_MIN_DATA_POINTS_THRESHOLD
            ))
        }
    };

    tokio::task::Builder::new()
        .name("anomaly_detection")
        .spawn(anomaly_detection_future)
        .context("Failed to spawn feed slots manager anomaly detection!")?
        .await
        .context("Failed to join feed slots manager anomaly detection!")?
}

fn check_aggregated_votes_deviation(
    updates: &[VotedFeedUpdate],
    block_height: u64,
    last_votes: &HashMap<u32, VotedFeedUpdate>,
    tolerated_deviations: &HashMap<u32, f64>,
) -> Result<()> {
    let mut errors = Vec::new();

    for update in updates {
        let feed_id = update.feed_id;
        let Some(reporter_vote) = last_votes.get(&feed_id) else {
            anyhow::bail!("Failed to get latest vote for feed_id: {}", feed_id);
        };

        let update_aggregate_value = match update.value {
            FeedType::Numerical(v) => v,
            _ => anyhow::bail!(
                "Non numeric value in update_aggregate_value for feed_id: {}",
                feed_id
            ),
        };

        let reporter_voted_value = match reporter_vote.value {
            FeedType::Numerical(v) => v,
            _ => anyhow::bail!(
                "Non numeric value in reporter_vote for feed_id: {}",
                feed_id
            ),
        };

        let tolerated_diff_percent = tolerated_deviations.get(&feed_id).unwrap_or(&0.5);
        let tolerated_difference = (tolerated_diff_percent / 100.0) * reporter_voted_value;

        let lower_bound = reporter_voted_value - tolerated_difference;
        let upper_bound = reporter_voted_value + tolerated_difference;

        let difference = (reporter_voted_value - update_aggregate_value).abs();
        let deviated_by_percent = (difference / reporter_voted_value) * 100.0;

        if update_aggregate_value < lower_bound || update_aggregate_value > upper_bound {
            errors.push(format!("Final answer for feed={feed_id}, block_height={block_height}, deviates by more than {tolerated_diff_percent}% ({deviated_by_percent}%). Reported value is {reporter_voted_value}. Sequencer reported {update_aggregate_value}"));
        }
        debug!("Final answer for feed={feed_id}, block_height={block_height}, deviates by {deviated_by_percent}%");
    }

    if !errors.is_empty() {
        bail!(errors.iter().join("\n"));
    }

    Ok(())
}

pub async fn validate(
    feeds_config: HashMap<u32, FeedStrideAndDecimals>,
    mut batch: ConsensusSecondRoundBatch,
    last_votes: HashMap<u32, VotedFeedUpdate>,
    tolerated_deviations: HashMap<u32, f64>,
) -> Result<()> {
    check_aggregated_votes_deviation(
        &batch.updates,
        batch.block_height,
        &last_votes,
        &tolerated_deviations,
    )?;

    let updates_to_serialize = BatchedAggegratesToSend {
        block_height: batch.block_height,
        updates: batch.updates,
    };

    let calldata = match adfs_serialize_updates(
        &batch.network,
        &updates_to_serialize,
        None,
        feeds_config,
        &mut batch.feeds_rounds,
    )
    .await
    {
        Ok(val) => val,
        Err(e) => anyhow::bail!("Failed to recreate calldata: {e}"),
    };

    let batch_calldata_bytes = alloy::hex::decode(&batch.calldata)?;

    if calldata != batch_calldata_bytes {
        info!(
            "calldata recvd by sequencer {} is not equal to calldata {} generated by {:?}",
            batch.calldata,
            alloy::hex::encode(&calldata),
            updates_to_serialize
        );
    }

    let contract_address = match Address::from_str(batch.contract_address.as_str()) {
        Ok(addr) => addr,
        Err(e) => {
            anyhow::bail!(
                "Non valid contract address ({}) provided: {}",
                batch.contract_address.as_str(),
                e
            );
        }
    };

    let safe_address = match Address::from_str(batch.safe_address.as_str()) {
        Ok(addr) => addr,
        Err(e) => {
            anyhow::bail!(
                "Non valid safe address ({}) provided: {}",
                batch.contract_address.as_str(),
                e
            );
        }
    };
    let nonce = match Uint::<256, 4>::from_str(batch.nonce.as_str()) {
        Ok(n) => n,
        Err(e) => {
            anyhow::bail!("Non valid nonce ({}) provided: {}", batch.nonce.as_str(), e);
        }
    };

    let safe_transaction = create_safe_tx(contract_address, Bytes::from(calldata.clone()), nonce);

    let chain_id: u64 = match batch.chain_id.as_str().parse() {
        Ok(v) => v,
        Err(e) => {
            anyhow::bail!("Non valid chain_id ({}) provided: {}", batch.chain_id, e);
        }
    };

    let tx_hash =
        generate_transaction_hash(safe_address, U256::from(chain_id), safe_transaction).to_vec();

    if tx_hash != alloy::hex::decode(&batch.tx_hash)? {
        let block_height = batch.block_height;
        let recvd_calldata = batch.calldata;
        anyhow::bail!(
            "tx_hash mismatch, block_height = {block_height}; recvd: {} generated: {}; calc_calldata = {}; recvd_calldata = {recvd_calldata}",
            batch.tx_hash,
            hex::encode(tx_hash),
            hex::encode(calldata),
        );
    }

    Ok(())
}

#[cfg(test)]
pub mod tests {
    use std::collections::HashSet;

    use super::*;

    fn create_feeds_config() -> HashMap<u32, FeedStrideAndDecimals> {
        let mut config = HashMap::new();

        for feed_id in 0..15 {
            config.insert(
                feed_id,
                FeedStrideAndDecimals {
                    stride: 0,
                    decimals: 18,
                },
            );
        }
        config.insert(
            5,
            FeedStrideAndDecimals {
                stride: 0,
                decimals: 8,
            },
        );
        config.insert(
            11,
            FeedStrideAndDecimals {
                stride: 1,
                decimals: 4,
            },
        );
        config
    }

    async fn call_validate_with_values(
        reporter_feed_ids: [u32; 3],
        reporter_last_votes: [f64; 3],
        aggregated_feed_ids: [u32; 3],
        aggregated_values: [f64; 3],
    ) -> Result<()> {
        let mut last_votes = HashMap::new();
        // The last votes of the reporter.
        last_votes.insert(
            reporter_feed_ids[0],
            VotedFeedUpdate {
                feed_id: 1,
                value: FeedType::Numerical(reporter_last_votes[0]),
                end_slot_timestamp: 1677654321,
            },
        );
        last_votes.insert(
            reporter_feed_ids[1],
            VotedFeedUpdate {
                feed_id: 5,
                value: FeedType::Numerical(reporter_last_votes[1]),
                end_slot_timestamp: 1677654322,
            },
        );
        last_votes.insert(
            reporter_feed_ids[2],
            VotedFeedUpdate {
                feed_id: 11,
                value: FeedType::Numerical(reporter_last_votes[2]),
                end_slot_timestamp: 1677654323,
            },
        );

        // Aggregated values proposed by the sequencer.
        let updates = vec![
            VotedFeedUpdate {
                feed_id: aggregated_feed_ids[0],
                value: FeedType::Numerical(aggregated_values[0]),
                end_slot_timestamp: 1677654321,
            },
            VotedFeedUpdate {
                feed_id: aggregated_feed_ids[1],
                value: FeedType::Numerical(aggregated_values[1]),
                end_slot_timestamp: 1677654322,
            },
            VotedFeedUpdate {
                feed_id: aggregated_feed_ids[2],
                value: FeedType::Numerical(aggregated_values[2]),
                end_slot_timestamp: 1677654323,
            },
        ];

        let mut feeds_rounds: HashMap<u32, u64> = HashMap::new();
        feeds_rounds.insert(1, 1000);
        feeds_rounds.insert(5, 2000);
        feeds_rounds.insert(11, 3000);
        feeds_rounds.insert(3, 4000);

        let block_height = 100;
        let network = "ETH".to_string();

        let updates_to_serialize = BatchedAggegratesToSend {
            block_height,
            updates: updates.clone(),
        };

        let calldata = adfs_serialize_updates(
            network.as_str(),
            &updates_to_serialize,
            None,
            create_feeds_config(),
            &mut feeds_rounds,
        )
        .await
        .unwrap();

        let contract_address = "0x663F3ad617193148711d28f5334eE4Ed07016602";
        let nonce_str = "10";
        let chain_id = 31337;
        let safe_address_str = "0x7f09E80DA1dFF8df7F1513E99a3458b228b9e19C";

        let nonce = match Uint::<256, 4>::from_str(nonce_str) {
            Ok(n) => n,
            Err(e) => {
                anyhow::bail!("Non valid nonce ({}) provided: {}", nonce_str, e);
            }
        };

        let safe_transaction = create_safe_tx(
            Address::from_str(contract_address).unwrap(),
            Bytes::from(calldata.clone()),
            nonce,
        );

        let tx_hash = generate_transaction_hash(
            Address::from_str(safe_address_str).unwrap(),
            U256::from(chain_id),
            safe_transaction,
        )
        .to_vec();

        let consensus_second_rond_batch = ConsensusSecondRoundBatch {
            sequencer_id: 0,
            block_height,
            network,
            contract_address: contract_address.to_string(),
            safe_address: safe_address_str.to_string(),
            nonce: nonce_str.to_string(),
            chain_id: chain_id.to_string(),
            tx_hash: hex::encode(tx_hash),
            calldata: hex::encode(calldata),
            updates,
            feeds_rounds,
        };

        let feed_ids_union: HashSet<u32> = HashSet::from_iter(
            reporter_feed_ids
                .iter()
                .copied()
                .chain(aggregated_feed_ids.iter().copied()),
        );

        let tolerated_deviations = feed_ids_union
            .into_iter()
            .map(|feed_id| (feed_id, 1.0))
            .collect();

        validate(
            create_feeds_config(),
            consensus_second_rond_batch,
            last_votes,
            tolerated_deviations,
        )
        .await
    }

    #[tokio::test]
    async fn test_validate_with_confirmable_input() {
        // All the last votes of the reporter are within 1% deviation from the aggregated values.
        let result = call_validate_with_values(
            [1, 5, 11],
            [42.1, 110.6, 552.0],
            [1, 5, 11],
            [42.5, 111.5, 555.5],
        )
        .await;

        assert!(
            result.is_ok(),
            "validate failed with error: {:?}",
            result.unwrap_err()
        );
    }

    #[tokio::test]
    async fn test_validate_with_non_confirmable_input() {
        // The third vote of the reporter is not within 1% deviation from the aggregated value.
        let result = call_validate_with_values(
            [1, 5, 11],
            [42.1, 110.6, 549.5],
            [1, 5, 11],
            [42.5, 111.5, 555.5],
        )
        .await;

        assert!(
            result.is_err(),
            "validate confirmation of higher than 1% deviation!"
        );

        let expected_error = "deviates by more than";

        // Extract the error and check
        let error_message = result.unwrap_err().to_string();
        assert!(
            error_message.contains(expected_error),
            "Expected error message to contain {expected_error}, but got: {error_message}",
        );
        info!(
            "validate correctly did not approve batch of aggregates: {:?}",
            error_message
        );
    }

    #[tokio::test]
    async fn test_validate_with_non_confirmable_input_due_to_missing_vote_from_reporter() {
        // All the last votes of the reporter are within 1% deviation from the aggregated values.
        let result = call_validate_with_values(
            [1, 4, 11],
            [42.1, 110.6, 552.0],
            [1, 5, 11],
            [42.5, 111.5, 555.5],
        )
        .await;

        let expected_error = "Failed to get latest vote for feed_id: 5";

        // Extract the error and check
        let error_message = result.unwrap_err().to_string();

        assert_eq!(
            error_message, expected_error,
            "Unexpected error message: {}",
            error_message
        );
    }
}
