use alloy::providers::Provider;
use alloy::rpc::types::TransactionRequest;
use alloy::{
    dyn_abi::DynSolValue,
    hex,
    network::{EthereumWallet, TransactionBuilder},
    primitives::Address,
    providers::{
        fillers::{
            BlobGasFiller, ChainIdFiller, FillProvider, GasFiller, JoinFill, NonceFiller,
            WalletFiller,
        },
        Identity, ProviderBuilder, RootProvider,
    },
    signers::local::PrivateKeySigner,
};

use alloy_primitives::Bytes;
use blocksense_feeds_processing::adfs_gen_calldata::RoundCounters;
use reqwest::Url;

use blocksense_config::{AllFeedsConfig, PublishCriteria, SequencerConfig};
use blocksense_data_feeds::feeds_processing::{
    BatchedAggegratesToSend, PublishedFeedUpdate, PublishedFeedUpdateError, VotedFeedUpdate,
};
use blocksense_feed_registry::registry::{FeedAggregateHistory, HistoryEntry};
use blocksense_feed_registry::types::FeedType;
use blocksense_metrics::{metrics::ProviderMetrics, process_provider_getter};
use eyre::{eyre, Result};
use paste::paste;
use ringbuf::traits::{Consumer, Observer, RingBuffer};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::{fs, mem};
use tokio::sync::{Mutex, RwLock};
use tokio::time::error::Elapsed;
use tokio::time::Duration;
use tracing::{debug, error, info, warn};

use crate::providers::multicall::Multicall;
use crate::providers::provider::Multicall::MulticallInstance;
use std::time::Instant;

pub type ProviderType = FillProvider<
    JoinFill<
        JoinFill<
            Identity,
            JoinFill<GasFiller, JoinFill<BlobGasFiller, JoinFill<NonceFiller, ChainIdFiller>>>,
        >,
        WalletFiller<EthereumWallet>,
    >,
    RootProvider,
>;

pub fn parse_eth_address(addr: &str) -> Option<Address> {
    let contract_address: Option<Address> = addr.parse().ok();
    contract_address
}

#[derive(Clone)]
pub struct Contract {
    pub name: String,
    pub address: Option<Address>,
    pub byte_code: Option<Vec<u8>>,
    pub contract_version: u16,
}

pub const HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME: &str = "HistoricalDataFeedStoreV2";
pub const SPORTS_DATA_FEED_STORE_V2_CONTRACT_NAME: &str = "SportsDataFeedStoreV2";
pub const ADFS_CONTRACT_NAME: &str = "AggregatedDataFeedStore";
pub const MULTICALL_CONTRACT_NAME: &str = "multicall";
pub const GNOSIS_SAFE_CONTRACT_NAME: &str = "gnosis_safe";

pub struct RpcProvider {
    pub network: String,
    pub provider: ProviderType,
    pub signer: PrivateKeySigner,
    pub safe_min_quorum: u32,
    pub provider_metrics: Arc<RwLock<ProviderMetrics>>,
    pub transaction_retries_count_limit: u32,
    pub transaction_retry_timeout_secs: u32,
    pub retry_fee_increment_fraction: f64,
    pub transaction_gas_limit: u32,
    pub impersonated_anvil_account: Option<Address>,
    pub history: FeedAggregateHistory,
    pub publishing_criteria: HashMap<u32, PublishCriteria>,
    pub feeds_variants: HashMap<u32, (FeedType, usize)>,
    pub contracts: Vec<Contract>,
    pub rpc_url: Url,
    pub round_counters: RoundCounters,
}

#[derive(PartialEq, Debug, Serialize, Deserialize)]
pub enum ProviderStatus {
    AwaitingFirstUpdate,
    Disabled,
    LastUpdateFailed,
    LastUpdateSucceeded,
}

pub type SharedRpcProviders = Arc<RwLock<HashMap<String, Arc<Mutex<RpcProvider>>>>>;

pub async fn init_shared_rpc_providers(
    conf: &SequencerConfig,
    prefix: Option<&str>,
    feeds_config: &AllFeedsConfig,
) -> SharedRpcProviders {
    let prefix = prefix.unwrap_or("");
    Arc::new(RwLock::new(
        get_rpc_providers(conf, prefix, feeds_config).await,
    ))
}

async fn get_rpc_providers(
    conf: &SequencerConfig,
    prefix: &str,
    feeds_config: &AllFeedsConfig,
) -> HashMap<String, Arc<Mutex<RpcProvider>>> {
    let mut providers: HashMap<String, Arc<Mutex<RpcProvider>>> = HashMap::new();

    let provider_metrics = Arc::new(RwLock::new(
        ProviderMetrics::new(prefix).expect("Failed to allocate ProviderMetrics"),
    ));

    for (net, p) in &conf.providers {
        let rpc_url: Url = p
            .url
            .parse()
            .unwrap_or_else(|_| panic!("Not a valid url provided for {net}!"));
        let priv_key_path = &p.private_key_path;
        let priv_key = fs::read_to_string(priv_key_path.clone()).unwrap_or_else(|_| {
            panic!(
                "Failed to read private key for {} from {}",
                net, priv_key_path
            )
        });
        let signer: PrivateKeySigner = priv_key
            .trim()
            .parse()
            .unwrap_or_else(|_| panic!("Incorrect private key specified {}.", priv_key));

        let rpc_provider = RpcProvider::new(
            net.as_str(),
            rpc_url,
            &signer,
            p,
            &provider_metrics,
            feeds_config,
        );
        rpc_provider
            .log_if_contract_exists(HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME)
            .await;
        rpc_provider
            .log_if_contract_exists(SPORTS_DATA_FEED_STORE_V2_CONTRACT_NAME)
            .await;

        let rpc_provider = Arc::new(Mutex::new(rpc_provider));

        providers.insert(net.clone(), rpc_provider.clone());
    }

    debug!("List of providers:");
    for (key, value) in &providers {
        let provider = &value.lock().await.provider;
        debug!("{}: {:?}", key, provider);
    }

    providers
}

pub struct LatestRound {
    _feed_id: u128,
    _round: u16,
}

impl LatestRound {
    pub fn new(_feed_id: u128, data: &[u8]) -> LatestRound {
        LatestRound {
            _feed_id,
            _round: data[0] as u16,
        }
    }
}

impl RpcProvider {
    pub fn new(
        network: &str,
        rpc_url: Url,
        signer: &PrivateKeySigner,
        p: &blocksense_config::Provider,
        provider_metrics: &Arc<tokio::sync::RwLock<ProviderMetrics>>,
        feeds_config: &AllFeedsConfig,
    ) -> RpcProvider {
        let provider = ProviderBuilder::new()
            .wallet(EthereumWallet::from(signer.clone()))
            .on_http(rpc_url.clone());

        let impersonated_anvil_account = p
            .impersonated_anvil_account
            .as_ref()
            .and_then(|x| parse_eth_address(x.as_str()));
        let (history, publishing_criteria) = RpcProvider::prepare_history(p);
        let contracts = RpcProvider::prepare_contracts(p);
        let mut feeds_variants: HashMap<u32, (FeedType, usize)> = HashMap::new();
        for f in feeds_config.feeds.iter() {
            debug!("Registering feed for network; feed={f:?}; network={network}");
            match FeedType::get_variant_from_string(f.value_type.as_str()) {
                Ok(variant) => {
                    feeds_variants
                        .insert(f.id, (variant, f.additional_feed_info.decimals as usize));
                }
                _ => {
                    error!("Unknown feed value variant = {}", f.value_type);
                }
            }
        }
        RpcProvider {
            network: network.to_string(),
            provider,
            signer: signer.clone(),
            safe_min_quorum: p.safe_min_quorum,
            provider_metrics: provider_metrics.clone(),
            transaction_retries_count_limit: p.transaction_retries_count_before_give_up,
            transaction_retry_timeout_secs: p.transaction_retry_timeout_secs,
            retry_fee_increment_fraction: p.retry_fee_increment_fraction,
            transaction_gas_limit: p.transaction_gas_limit,
            impersonated_anvil_account,
            history,
            publishing_criteria,
            feeds_variants,
            contracts,
            rpc_url,
            round_counters: HashMap::new(),
        }
    }

    pub fn prepare_history(
        p: &blocksense_config::Provider,
    ) -> (FeedAggregateHistory, HashMap<u32, PublishCriteria>) {
        let mut history = FeedAggregateHistory::new();
        let mut publishing_criteria: HashMap<u32, PublishCriteria> = HashMap::new();

        for crit in p.publishing_criteria.iter() {
            let feed_id = crit.feed_id;
            let buf_size = 256;
            if publishing_criteria
                .insert(crit.feed_id, crit.clone())
                .is_none()
            {
                history.register_feed(feed_id, buf_size);
            }
        }
        (history, publishing_criteria)
    }

    pub fn prepare_contracts(p: &blocksense_config::Provider) -> Vec<Contract> {
        let address = p
            .contract_address
            .as_ref()
            .and_then(|x| parse_eth_address(x.as_str()));
        let safe_address = p
            .safe_address
            .as_ref()
            .and_then(|x| parse_eth_address(x.as_str()));
        let event_address = p
            .event_contract_address
            .as_ref()
            .and_then(|x| parse_eth_address(x.as_str()));
        let multicall_address = p
            .multicall_contract_address
            .as_ref()
            .and_then(|x| parse_eth_address(x.as_str()));

        let mut contracts = vec![];
        contracts.push(Contract {
            name: HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME.to_string(),
            address,
            byte_code: p.data_feed_store_byte_code.clone().map(|byte_code| {
                hex::decode(byte_code.clone())
                    .expect("data_feed_store_byte_code for provider is not valid hex string!")
            }),
            contract_version: p.contract_version,
        });

        contracts.push(Contract {
            name: SPORTS_DATA_FEED_STORE_V2_CONTRACT_NAME.to_string(),
            address: event_address,
            byte_code: p.data_feed_sports_byte_code.clone().map(|byte_code| {
                hex::decode(byte_code.clone())
                    .expect("data_feed_sports_byte_code for provider is not valid hex string!")
            }),
            contract_version: p.contract_version,
        });

        contracts.push(Contract {
            name: GNOSIS_SAFE_CONTRACT_NAME.to_string(),
            address: safe_address,
            byte_code: None,
            contract_version: 1,
        });

        contracts.push(Contract {
            name: MULTICALL_CONTRACT_NAME.to_string(),
            address: multicall_address,
            byte_code: Some(Multicall::BYTECODE.to_vec()),
            contract_version: 1,
        });

        contracts
    }

    pub fn update_history(&mut self, updates: &[VotedFeedUpdate]) {
        for update in updates.iter() {
            let feed_id = update.feed_id;
            self.history
                .push_next(feed_id, update.value.clone(), update.end_slot_timestamp);
        }
    }

    pub fn apply_publish_criteria(&self, updates: &mut BatchedAggegratesToSend) {
        let mut res = updates
            .updates
            .iter()
            .filter(|update| {
                self.publishing_criteria
                    .get(&update.feed_id)
                    .is_none_or(|criteria| {
                        !update.should_skip(criteria, &self.history).should_skip()
                    })
            })
            .cloned()
            .collect::<Vec<VotedFeedUpdate>>();
        updates.updates = mem::take(&mut res);
    }

    pub fn peg_stable_coins_to_value(&self, updates: &mut BatchedAggegratesToSend) {
        for u in updates.updates.iter_mut() {
            if let FeedType::Numerical(value) = u.value {
                if let Some(criteria) = self
                    .publishing_criteria
                    .get(&u.feed_id)
                    .filter(|criteria| criteria.should_peg(value))
                {
                    Self::peg_value(criteria, &mut u.value);
                }
            }
        }
    }

    pub fn peg_value(criteria: &PublishCriteria, value: &mut FeedType) {
        if let Some(peg_value) = criteria.peg_to_value {
            *value = FeedType::Numerical(peg_value);
        }
    }

    pub fn get_contract(&self, name: &str) -> Option<Contract> {
        for c in self.contracts.iter() {
            if c.name == name {
                return Some(c.clone());
            }
        }
        None
    }

    pub fn get_contract_address(&self, name: &str) -> Result<Address> {
        let address = self
            .get_contract(name)
            .ok_or(eyre!("{name} contract is not set!"))?
            .address
            .ok_or(eyre!("{name} contract address is not set!"))?;
        Ok(address)
    }

    pub fn set_contract_address(&mut self, name: &str, address: &Address) {
        for c in self.contracts.iter_mut() {
            if c.name == name {
                c.address = Some(*address);
            }
        }
    }

    pub async fn get_latest_round(
        &self,
        feed_id: &u128,
        stride: u32,
    ) -> Result<Vec<LatestRound>, eyre::Error> {
        let call_data = Bytes::copy_from_slice(&[
            0x81_u8,
            (stride & 0xFF_u32) as u8,
            ((*feed_id >> (8 * 14)) & 0xFF_u128) as u8,
            ((*feed_id >> (8 * 13)) & 0xFF_u128) as u8,
            ((*feed_id >> (8 * 12)) & 0xFF_u128) as u8,
            ((*feed_id >> (8 * 11)) & 0xFF_u128) as u8,
            ((*feed_id >> (8 * 10)) & 0xFF_u128) as u8,
            ((*feed_id >> (8 * 9)) & 0xFF_u128) as u8,
            ((*feed_id >> (8 * 8)) & 0xFF_u128) as u8,
            ((*feed_id >> (8 * 7)) & 0xFF_u128) as u8,
            ((*feed_id >> (8 * 6)) & 0xFF_u128) as u8,
            ((*feed_id >> (8 * 5)) & 0xFF_u128) as u8,
            ((*feed_id >> (8 * 4)) & 0xFF_u128) as u8,
            ((*feed_id >> (8 * 3)) & 0xFF_u128) as u8,
            ((*feed_id >> (8 * 2)) & 0xFF_u128) as u8,
            ((*feed_id >> (8/* * 1*/)) & 0xFF_u128) as u8,
            ((*feed_id/* >> (8 * 0)*/) & 0xFF_u128) as u8,
        ]);

        let multicall = self.get_contract_address(MULTICALL_CONTRACT_NAME)?;
        let data_feed = self.get_contract_address(ADFS_CONTRACT_NAME)?;

        let contract = MulticallInstance::new(multicall, self.provider.clone());

        let calldata: Vec<Multicall::Call> = vec![Multicall::Call {
            target: data_feed,
            callData: call_data,
        }];

        let aggregate_return = contract.aggregate(calldata).call().await?;
        let latest_rounds: Vec<LatestRound> = aggregate_return
            .returnData
            .into_iter()
            .map(|data| LatestRound::new(*feed_id, &data.0))
            .collect();

        Ok(latest_rounds)
    }

    pub async fn get_latest_values(
        &self,
        feed_ids: &[u32],
    ) -> Result<Vec<Result<PublishedFeedUpdate, PublishedFeedUpdateError>>, eyre::Error> {
        let multicall = self.get_contract_address(MULTICALL_CONTRACT_NAME)?;
        let data_feed = self.get_contract_address(HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME)?;
        let contract = MulticallInstance::new(multicall, self.provider.clone());
        let calldata: Vec<Multicall::Call> = feed_ids
            .iter()
            .map(|feed_id| {
                let call_data = Bytes::copy_from_slice(&[
                    (((*feed_id >> 24) & 0xFF_u32) | 0xC0) as u8,
                    ((*feed_id >> 16) & 0xFF_u32) as u8,
                    ((*feed_id >> 8) & 0xFF_u32) as u8,
                    (*feed_id & 0xFF_u32) as u8,
                ]);
                Multicall::Call {
                    target: data_feed,
                    callData: call_data,
                }
            })
            .collect();
        let mut digits: Vec<usize> = vec![];
        let mut variants: Vec<FeedType> = vec![];
        for feed_id in feed_ids.iter() {
            let Some((variant, digits_in_fraction)) = self.feeds_variants.get(feed_id) else {
                return Err(eyre!(
                    "Unknown variant and number of digits for feed with id = {feed_id}"
                ));
            };
            digits.push(*digits_in_fraction);
            variants.push(variant.clone());
        }

        let aggregate_return = contract.aggregate(calldata).call().await?;
        let res = aggregate_return
            .returnData
            .into_iter()
            .enumerate()
            .map(|(count, data)| {
                PublishedFeedUpdate::latest(
                    feed_ids[count],
                    variants[count].clone(),
                    digits[count],
                    &data.0,
                )
            })
            .collect();
        Ok(res)
    }

    pub async fn get_historical_values_for_feed(
        &self,
        feed_id: u32,
        updates: &[u128],
    ) -> Result<Vec<Result<PublishedFeedUpdate, PublishedFeedUpdateError>>> {
        let multicall = self.get_contract_address(MULTICALL_CONTRACT_NAME)?;
        let data_feed = self.get_contract_address(HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME)?;

        let contract = MulticallInstance::new(multicall, self.provider.clone());

        let calldata: Vec<Multicall::Call> = updates
            .iter()
            .map(|update| {
                let mut a = [
                    (((feed_id >> 24) & 0xFF_u32) | 0x20) as u8,
                    ((feed_id >> 16) & 0xFF_u32) as u8,
                    ((feed_id >> 8) & 0xFF_u32) as u8,
                    (feed_id & 0xFF_u32) as u8,
                ]
                .to_vec();
                a.append(&mut 0_u128.to_be_bytes().to_vec());
                a.append(&mut update.to_be_bytes().to_vec());

                let call_data = Bytes::copy_from_slice(&a);
                Multicall::Call {
                    target: data_feed,
                    callData: call_data,
                }
            })
            .collect();
        let Some((variant, digits_in_fraction)) = self.feeds_variants.get(&feed_id) else {
            return Err(eyre!(
                "Unknown variant and number of digits for feed with id = {feed_id}"
            ));
        };
        let aggregate_return = contract.aggregate(calldata).call().await?;
        let res = aggregate_return
            .returnData
            .into_iter()
            .enumerate()
            .map(|(count, data)| {
                PublishedFeedUpdate::nth(
                    feed_id,
                    updates[count],
                    variant.clone(),
                    *digits_in_fraction,
                    &data.0,
                )
            })
            .collect();
        Ok(res)
    }

    pub fn get_history_capacity(&self, feed_id: u32) -> Option<usize> {
        self.history.get(feed_id).map(|x| x.capacity().get())
    }
    pub fn get_last_update_num_from_history(&self, feed_id: u32) -> u128 {
        let default = 0;
        self.history
            .get(feed_id)
            .map_or(default, |x| x.last().map_or(default, |x| x.update_number))
    }

    pub async fn deploy_contract(&mut self, contract_name: &str) -> Result<String> {
        let signer = &self.signer;
        let provider = &self.provider;
        let provider_metrics = &self.provider_metrics;

        let mut bytecode = self
            .get_contract(contract_name)
            .ok_or(eyre!("{contract_name} contract is not set!"))?
            .byte_code
            .ok_or(eyre!(
                "Byte code unavailable for contract named {contract_name}"
            ))?;

        // Deploy the contract.
        let network = self.network.clone();
        let _max_priority_fee_per_gas = process_provider_getter!(
            provider.get_max_priority_fee_per_gas().await,
            network,
            provider_metrics,
            get_max_priority_fee_per_gas
        );

        let chain_id = process_provider_getter!(
            provider.get_chain_id().await,
            network,
            provider_metrics,
            get_chain_id
        );

        let message_value = DynSolValue::Tuple(vec![DynSolValue::Address(signer.address())]);

        let mut encoded_arg = message_value.abi_encode();
        bytecode.append(&mut encoded_arg);

        let tx = TransactionRequest::default()
            .from(signer.address())
            .with_chain_id(chain_id)
            .with_deploy_code(bytecode);

        let deploy_time = Instant::now();
        let contract_address = provider
            .send_transaction(tx)
            .await?
            .get_receipt()
            .await?
            .contract_address
            .expect("Failed to get contract address");

        info!(
            "Deployed {:?} contract at address: {:?} took {} ms\n",
            contract_name,
            contract_address.to_string(),
            deploy_time.elapsed().as_millis()
        );
        self.set_contract_address(contract_name, &contract_address);
        Ok(format!("CONTRACT_ADDRESS set to {}", contract_address))
    }

    pub async fn can_read_contract_bytecode(
        &self,
        addr: &Address,
        timeout_duration: Duration,
    ) -> Result<bool, Elapsed> {
        actix_web::rt::time::timeout(timeout_duration, self.provider.get_code_at(*addr))
            .await
            .map(|r| r.is_ok_and(|bytecode| bytecode.to_string() != "0x"))
    }

    pub fn url(&self) -> Url {
        self.rpc_url.clone()
    }

    pub async fn log_if_contract_exists(&self, contract_name: &str) {
        let address = self.get_contract_address(contract_name).ok();
        let network = self.network.as_str();
        if let Some(addr) = address {
            info!("Contract {contract_name} for network {network} address set to {addr}. Checking if contract exists ...");

            let result = self
                .can_read_contract_bytecode(&addr, Duration::from_secs(5))
                .await;
            match result {
                Ok(exists) => {
                    if exists {
                        info!(
                            "Contract for network {} exists on address {}",
                            network, addr
                        );
                    } else {
                        warn!(
                            "No contract for network {} exists on address {}",
                            network, addr
                        );
                    }
                }
                Err(e) => {
                    warn!("JSON rpc request to verify contract existence timed out: {e}");
                }
            };
        } else {
            warn!("No contract address set for network {}", network);
        }
    }

    pub async fn load_history_from_chain(
        &mut self,
        feed_id: u32,
        limit_entries: u32,
    ) -> Result<u32> {
        let latest = self.get_latest_values(&[feed_id]).await?;
        if !latest.is_empty() {
            let num_updates = match &latest[0] {
                Ok(latest) => latest.num_updates,
                Err(latest) => latest.num_updates,
            };
            let limit = if (limit_entries as u128) < num_updates {
                limit_entries
            } else {
                num_updates as u32
            };
            let Some(capacity) = self.get_history_capacity(feed_id) else {
                return Err(eyre!("History is not registered for feed id = {feed_id}"));
            };
            let limit = if capacity < (limit as usize) {
                capacity as u32
            } else {
                limit as u32
            };

            let end_update_num = num_updates + 1;
            let mut start_update_num = (num_updates + 1) - (limit as u128);

            let last_update_num = self.get_last_update_num_from_history(feed_id);
            if start_update_num < last_update_num + 1 {
                start_update_num = last_update_num + 1
            }

            let range = start_update_num..end_update_num;

            let updates = range.collect::<Vec<u128>>();
            let values = self
                .get_historical_values_for_feed(feed_id, &updates)
                .await?;
            let Some(history) = self.history.get_mut(feed_id) else {
                return Err(eyre!("History is not registered for feed id = {feed_id}"));
            };

            let mut count: u32 = 0;
            for v in values {
                let Ok(v) = v else {
                    continue;
                };
                let elem = HistoryEntry {
                    value: v.value,
                    update_number: v.num_updates,
                    end_slot_timestamp: v.published,
                };
                let _ = history.push_overwrite(elem);
                count += 1;
            }
            Ok(count)
        } else {
            Ok(0)
        }
    }
}
// pub fn print_type<T>(_: &T) {
//     println!("{:?}", std::any::type_name::<T>());
// }

#[cfg(test)]
mod tests {
    use super::*;
    use alloy::{
        network::TransactionBuilder, node_bindings::Anvil, primitives::U256,
        rpc::types::eth::request::TransactionRequest,
    };
    use alloy_primitives::address;
    use blocksense_utils::test_env::get_test_private_key_path;

    use crate::providers::provider::get_rpc_providers;
    use alloy::consensus::Transaction;
    use alloy::providers::Provider as AlloyProvider;
    use blocksense_config::get_test_config_with_single_provider;

    #[tokio::test]
    async fn basic_test_provider() -> Result<()> {
        let network = "ETH";

        let anvil = Anvil::new().try_spawn()?;
        let key_path = get_test_private_key_path();

        let cfg =
            get_test_config_with_single_provider(network, key_path.as_path(), &anvil.endpoint());
        let feeds_config = AllFeedsConfig { feeds: vec![] };
        let providers = get_rpc_providers(&cfg, "basic_test_provider_", &feeds_config).await;
        let provider = &providers.get(network).unwrap().lock().await.provider;

        let alice = anvil.addresses()[7];
        let bob = anvil.addresses()[0];

        let tx = TransactionRequest::default()
            .with_from(alice)
            .with_to(bob)
            .with_value(U256::from(100))
            // It is required to set the chain_id for EIP-1559 transactions.
            .with_chain_id(anvil.chain_id());

        // Send the transaction, the nonce (0) is automatically managed by the provider.
        let builder = provider.send_transaction(tx.clone()).await?;
        let node_hash = *builder.tx_hash();
        let pending_tx = provider.get_transaction_by_hash(node_hash).await?.unwrap();
        assert_eq!(pending_tx.nonce(), 0);

        println!("Transaction sent with nonce: {}", pending_tx.nonce());

        // Send the transaction, the nonce (1) is automatically managed by the provider.
        let tx = provider.send_transaction(tx).await?;

        let receipt = tx.get_receipt().await.unwrap();

        assert_eq!(receipt.effective_gas_price, 875_175_001);
        assert_eq!(receipt.gas_used, 21000);

        Ok(())
    }

    #[tokio::test]
    async fn test_get_wallet_success() {
        let network = "ETH1";
        let expected_wallet_address = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"; // generated as hash of private_key
        let key_path = get_test_private_key_path();

        let cfg = get_test_config_with_single_provider(
            network,
            key_path.as_path(),
            "http://localhost:8545",
        );
        let feeds_config = AllFeedsConfig { feeds: vec![] };
        let providers = get_rpc_providers(&cfg, "test_get_wallet_success_", &feeds_config).await;

        // Call the function
        let wallet = &providers[network].lock().await.signer;

        // Check if the wallet's address matches the expected address
        assert_eq!(wallet.address().to_string(), expected_wallet_address);
    }

    // Copied from the alloy source code as an example.
    #[tokio::test]
    async fn no_gas_price_or_limit() {
        let provider = ProviderBuilder::new().on_anvil_with_wallet();

        // GasEstimationLayer requires chain_id to be set to handle EIP-1559 tx
        let tx = TransactionRequest {
            value: Some(U256::from(100)),
            to: Some(address!("d8dA6BF26964aF9D7eEd9e03E53415D37aA96045").into()),
            chain_id: Some(31337),
            ..Default::default()
        };

        let tx = provider.send_transaction(tx).await.unwrap();

        let receipt = tx.get_receipt().await.unwrap();

        assert_eq!(receipt.effective_gas_price, 1_000_000_001);
        assert_eq!(receipt.gas_used, 21000);
    }

    #[tokio::test]
    async fn test_get_rpc_providers_returns_single_provider() {
        // setup
        let network = "ETH2";
        let key_path = get_test_private_key_path();

        let cfg = get_test_config_with_single_provider(
            network,
            key_path.as_path(),
            "http://localhost:8545",
        );
        let feeds_config = AllFeedsConfig { feeds: vec![] };
        // test
        let binding = init_shared_rpc_providers(
            &cfg,
            Some("test_get_rpc_providers_returns_single_provider_"),
            &feeds_config,
        )
        .await;
        let result = binding.read().await;

        // assert
        assert_eq!(result.len(), 1);
    }
}
