use anomaly_detection::ingest::anomaly_detector_aggregate;
use anyhow::{anyhow, Context, Result};
use blocksense_registry::config::FeedConfig;
use config::{FeedStrideAndDecimals, PublishCriteria};
use data_feeds::feeds_processing::{
    BatchedAggegratesToSend, VotedFeedUpdate, VotedFeedUpdateWithProof,
};
use feed_registry::aggregate::FeedAggregate;
use feed_registry::registry::FeedAggregateHistory;
use feed_registry::types::{DataFeedPayload, FeedMetaData, FeedType, Timestamp};
use gnosis_safe::data_types::ConsensusSecondRoundBatch;
use gnosis_safe::utils::{create_safe_tx, generate_transaction_hash};
use ringbuf::traits::consumer::Consumer;
// use serde_json::from_str;
use crate::adfs_gen_calldata::adfs_serialize_updates;
use alloy::hex::FromHex;
use alloy_primitives::{Address, Bytes, Uint, U256};
use crypto::{verify_signature, PublicKey, Signature};
use feed_registry::types::FeedResult;
use std::collections::{HashMap, HashSet};
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
        byte_buffer.extend(result.as_bytes(18));
    }
    verify_signature(pub_key, signature, &byte_buffer)
}

#[derive(Debug)]
pub struct ConsumedReports {
    pub is_quorum_reached: bool,
    pub skip_publishing: bool,
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
            skip_publishing: true,
            ad_score: None,
            result_post_to_contract: None,
            end_slot_timestamp,
        }
    } else {
        let total_votes_count = values.len() as f32;
        let required_votes_count = quorum_percentage * 0.01f32 * (num_reporters as f32);
        let is_quorum_reached = required_votes_count <= total_votes_count;
        let mut skip_publishing = false;
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
        if !is_oneshot {
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
                        skip_publishing =
                            result_post_to_contract.should_skip(&criteria, &history_guard);
                        debug!("Release the read lock on history [feed {feed_id}]");
                    }
                };
            };
        }
        let res = ConsumedReports {
            is_quorum_reached,
            skip_publishing,
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

type FeedId = u32;
type FeedTimestamp = u64;
type FeedIdToTimetamp = HashMap<FeedId, FeedTimestamp>;

pub async fn validate_sigcheck(
    feeds_config: Arc<RwLock<HashMap<u32, FeedConfig>>>,
    mut batch: ConsensusSecondRoundBatch,
    reporters_keys: HashMap<u64, PublicKey>,
    feeds_last_updated_slots: &mut FeedIdToTimetamp,
) -> Result<()> {
    // Check that all the aggregated values have a corresponding set of votes
    let feed_ids_in_updates: Vec<u32> = batch.updates.iter().map(|u| u.feed_id).collect();
    let feed_ids_in_proof: Vec<u32> = batch.proofs.keys().cloned().collect();

    if feed_ids_in_updates.len() != feed_ids_in_proof.len() {
        anyhow::bail!("Proofs / Updates size mismatch");
    }

    let feed_ids_in_updates: HashSet<_> = feed_ids_in_updates.into_iter().collect();
    let feed_ids_in_proof: HashSet<_> = feed_ids_in_proof.into_iter().collect();

    if feed_ids_in_updates != feed_ids_in_proof {
        anyhow::bail!("Proofs / Updates mismatch");
    }

    let mut feeds_newly_updated_slots = HashMap::<u32, u64>::new();

    for update in &batch.updates {
        let proof_for_update = batch
            .proofs
            .get(&update.feed_id)
            .expect("Proofs / Updates mismatch: above checks must verify this cannot happen!");

        let num_reporters = reporters_keys.len();

        let feeds_config = feeds_config.read().await;

        let Some(feed_config) = feeds_config.get(&update.feed_id) else {
            anyhow::bail!("Feed ID {} has no configuration.", &update.feed_id);
        };

        let feed_metadata = FeedMetaData::from_config(feed_config);

        drop(feeds_config);

        // Validate that the update and all the signed votes are for the same
        // slot based on the timestamps and feed_metadata
        // and make sure that this update has not been previously introduced!

        // Get the aggregated value's slot:
        let update_slot = feed_metadata.get_slot(update.end_slot_timestamp);

        // Make sure this slot's value was not previously proposed:
        let update_is_relevant = feeds_last_updated_slots
            .get(&update.feed_id)
            .is_some_and(|&slot| slot > update_slot);

        if !update_is_relevant {
            anyhow::bail!("Reintroduction of old value: {update:?}, {proof_for_update:?}");
        }

        feeds_newly_updated_slots.insert(update.feed_id, update_slot);

        // Check signatures
        for raw_vote in proof_for_update {
            let Some(reporter_pub_key) = reporters_keys.get(&raw_vote.payload_metadata.reporter_id)
            else {
                anyhow::bail!(
                    "No public key known for reporter with ID {}!",
                    raw_vote.payload_metadata.reporter_id
                );
            };

            // Make sure that all votes have the same slot as the aggregated value
            let vote_slot = feed_metadata.get_slot(raw_vote.payload_metadata.timestamp);
            if vote_slot != update_slot {
                anyhow::bail!(concat!(
                    "Received a vote not corresponding to the aggregated value's slot! vote: ",
                    "{raw_vote:?} update_slot: {update_slot} calculated vote slot: {vote_slot}"
                ));
            }

            if !check_signature(
                &raw_vote.payload_metadata.signature.sig,
                reporter_pub_key,
                raw_vote.payload_metadata.feed_id.as_str(),
                raw_vote.payload_metadata.timestamp,
                &raw_vote.result,
            ) {
                anyhow::bail!(
                    "Signature verification failed for vote {:?} from reporter id {} with pub key {:?}",
                    raw_vote,
                    raw_vote.payload_metadata.reporter_id,
                    reporter_pub_key,
                );
            }
        }

        let proof_for_update_mapping: HashMap<u64, DataFeedPayload> = proof_for_update
            .iter()
            .cloned()
            .map(|payload| (payload.payload_metadata.reporter_id, payload))
            .collect();

        let aggregator = match FeedAggregate::create_from_str(feed_metadata.aggregate_type.as_str())
        {
            Ok(val) => val,
            Err(e) => anyhow::bail!("Could not convert {} to a valid aggregator: {e}", {
                feed_metadata.aggregate_type.as_str()
            }),
        };

        let consumed_reports_result = consume_reports(
            format!("Feed ID: {}", update.feed_id).as_str(),
            &proof_for_update_mapping,
            &FeedType::Numerical(0.0),
            0,
            feed_metadata.quorum_percentage,
            feed_metadata.skip_publish_if_less_then_percentage as f64,
            feed_metadata.always_publish_heartbeat_ms,
            update.end_slot_timestamp,
            num_reporters,
            false,
            aggregator,
            None,
            update.feed_id,
        )
        .await;

        let Some(result_post_to_contract) = consumed_reports_result.result_post_to_contract else {
            anyhow::bail!(
                "Feed ID {}'s proof did not produce a result for sending to contract, but a value is present.",
                &update.feed_id
            );
        };

        if update.value != result_post_to_contract.update.value {
            anyhow::bail!(
                "Feed ID {}'s proof did not produce the expected result.",
                &update.feed_id
            );
        }
    }

    let updates_to_serialize = BatchedAggegratesToSend {
        block_height: batch.block_height,
        updates: batch.updates,
        proofs: batch.proofs,
    };

    let mut strides_and_decimals = HashMap::new();
    for update in updates_to_serialize.updates.iter() {
        let feed_id = update.feed_id;
        debug!("Acquiring a read lock on feeds_config; feed_id={feed_id}");
        let feed_config = feeds_config.read().await.get(&feed_id).cloned();
        debug!("Acquired and released a read lock on feeds_config; feed_id={feed_id}");

        strides_and_decimals.insert(
            feed_id,
            FeedStrideAndDecimals::from_feed_config(&feed_config),
        );
        drop(feed_config);
    }

    let calldata = match adfs_serialize_updates(
        &batch.network,
        &updates_to_serialize,
        None,
        strides_and_decimals,
        &mut batch.feeds_rounds,
    )
    .await
    {
        Ok(val) => val,
        Err(e) => anyhow::bail!("Failed to recreate calldata: {e}"),
    };

    let calldata = match Bytes::from_hex(calldata) {
        Ok(b) => b,
        Err(e) => {
            anyhow::bail!("calldata is not valid hex string: {}", e);
        }
    };

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
    let safe_transaction = create_safe_tx(contract_address, calldata, nonce);

    let chain_id: u64 = match batch.chain_id.as_str().parse() {
        Ok(v) => v,
        Err(e) => {
            anyhow::bail!("Non valid chain_id ({}) provided: {}", batch.chain_id, e);
        }
    };

    let tx_hash =
        generate_transaction_hash(safe_address, U256::from(chain_id), safe_transaction.clone());

    let tx_hash_str = tx_hash.to_string();

    if tx_hash_str != batch.tx_hash {
        anyhow::bail!(
            "tx_hash mismatch, recvd: {} generated: {}",
            batch.tx_hash,
            tx_hash_str
        );
    }

    // Store the last updated slots per feed
    for (key, val) in feeds_newly_updated_slots {
        feeds_last_updated_slots.insert(key, val);
    }

    Ok(())
}

pub async fn validate(
    feeds_config: HashMap<u32, FeedStrideAndDecimals>,
    mut batch: ConsensusSecondRoundBatch,
    last_votes: HashMap<u32, VotedFeedUpdate>,
    tolerated_deviations: HashMap<u32, f64>,
) -> Result<()> {
    for update in &batch.updates {
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

        let diff = (update_aggregate_value - reporter_voted_value).abs();

        let tolerated_diff_percent = tolerated_deviations.get(&feed_id).unwrap_or(&0.01);

        if reporter_voted_value.abs() < f64::EPSILON {
            if update_aggregate_value > *tolerated_diff_percent {
                anyhow::bail!("relative_diff {update_aggregate_value} between reporter_voted_value {reporter_voted_value} and update_aggregate_value {update_aggregate_value} is above {tolerated_diff_percent} for feed_id {feed_id}");
            }
        } else {
            let relative_diff = diff / reporter_voted_value;

            if relative_diff > *tolerated_diff_percent {
                anyhow::bail!("relative_diff {relative_diff} between reporter_voted_value {reporter_voted_value} and update_aggregate_value {update_aggregate_value} is above {tolerated_diff_percent} for feed_id {feed_id}");
            }
        }
    }

    let updates_to_serialize = BatchedAggegratesToSend {
        block_height: batch.block_height,
        updates: batch.updates,
        proofs: batch.proofs,
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

    let calldata = match Bytes::from_hex(calldata) {
        Ok(b) => b,
        Err(e) => {
            anyhow::bail!("calldata is not valid hex string: {}", e);
        }
    };

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
    let safe_transaction = create_safe_tx(contract_address, calldata, nonce);

    let chain_id: u64 = match batch.chain_id.as_str().parse() {
        Ok(v) => v,
        Err(e) => {
            anyhow::bail!("Non valid chain_id ({}) provided: {}", batch.chain_id, e);
        }
    };

    let tx_hash =
        generate_transaction_hash(safe_address, U256::from(chain_id), safe_transaction.clone());

    let tx_hash_str = tx_hash.to_string();

    if tx_hash_str != batch.tx_hash {
        anyhow::bail!(
            "tx_hash mismatch, recvd: {} generated: {}",
            batch.tx_hash,
            tx_hash_str
        );
    }

    Ok(())
}
