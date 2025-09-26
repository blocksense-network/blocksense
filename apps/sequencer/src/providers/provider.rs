use alloy::providers::Provider;
use alloy::rpc::types::{TransactionInput, TransactionRequest};
use alloy::{
    dyn_abi::DynSolValue,
    hex,
    network::{EthereumWallet, TransactionBuilder},
    primitives::{Address, Bytes},
    providers::{
        fillers::{FillProvider, JoinFill, WalletFiller},
        Identity, ProviderBuilder, RootProvider,
    },
    signers::local::PrivateKeySigner,
};
use alloy_primitives::U256;
use alloy_u256_literal::u256;
use blocksense_feeds_processing::adfs_gen_calldata::{
    RoundCounters, MAX_HISTORY_ELEMENTS_PER_FEED, NUM_FEED_IDS_IN_ROUND_RECORD,
};
use blocksense_utils::FeedId;
use futures::future::join_all;
use reqwest::Url; // TODO @ymadzhunkov include URL directly from url crate

use blocksense_config::{
    AllFeedsConfig, ContractConfig, PublishCriteria, SequencerConfig,
    ADFS_ACCESS_CONTROL_CONTRACT_NAME, ADFS_CONTRACT_NAME,
    HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME, MULTICALL_CONTRACT_NAME,
    SPORTS_DATA_FEED_STORE_V2_CONTRACT_NAME,
};
use blocksense_data_feeds::feeds_processing::{
    BatchedAggregatesToSend, PublishedFeedUpdate, PublishedFeedUpdateError, VotedFeedUpdate,
};
use blocksense_feed_registry::registry::{FeedAggregateHistory, HistoryEntry};
use blocksense_feed_registry::types::FeedType;
use blocksense_feed_registry::types::Repeatability;
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

use crate::providers::eth_send_utils::{get_gas_limit, get_tx_retry_params, GasFees};
use crate::providers::multicall::Multicall;
use crate::providers::provider::Multicall::MulticallInstance;
use std::time::Instant;

pub type ProviderType =
    FillProvider<JoinFill<Identity, WalletFiller<EthereumWallet>>, RootProvider>;

pub fn parse_eth_address(addr: &str) -> Option<Address> {
    let contract_address: Option<Address> = addr.parse().ok();
    contract_address
}

#[derive(Clone)]
pub struct Contract {
    pub name: String,
    pub address: Option<Address>,
    pub creation_byte_code: Option<Vec<u8>>,
    pub deployed_byte_code: Option<Vec<u8>>,
    pub contract_version: u16,
    pub min_quorum: Option<u32>,
}
impl Contract {
    pub fn new(config: &ContractConfig) -> Result<Contract> {
        let address = config
            .address
            .as_ref()
            .and_then(|x| parse_eth_address(x.as_str()));
        let creation_byte_code = config
            .creation_byte_code
            .as_ref()
            .and_then(|byte_code| hex::decode(byte_code.clone()).ok());
        let deployed_byte_code = config
            .deployed_byte_code
            .as_ref()
            .and_then(|byte_code| hex::decode(byte_code.clone()).ok());
        Ok(Contract {
            name: config.name.clone(),
            address,
            creation_byte_code,
            deployed_byte_code,
            contract_version: config.contract_version,
            min_quorum: config.min_quorum,
        })
    }
}

pub struct RpcProvider {
    pub network: String,
    pub provider: ProviderType,
    pub signer: PrivateKeySigner,
    pub provider_metrics: Arc<RwLock<ProviderMetrics>>,
    pub transaction_retries_count_before_give_up: u32,
    pub transaction_retry_timeout_secs: u32,
    pub retry_fee_increment_fraction: f64,
    pub transaction_gas_limit: u32,
    pub impersonated_anvil_account: Option<Address>,
    pub history: FeedAggregateHistory,
    pub publishing_criteria: HashMap<FeedId, PublishCriteria>,
    pub feeds_variants: HashMap<FeedId, FeedVariant>,
    pub contracts: Vec<Contract>,
    pub rpc_url: Url,
    pub round_counters: RoundCounters,
    pub limit_multicall_data_calls: usize,
    num_tx_in_progress: u32,
}

#[derive(PartialEq, Debug, Serialize, Deserialize)]
pub enum ProviderStatus {
    AwaitingFirstUpdate,
    Disabled,
    LastUpdateFailed,
    LastUpdateSucceeded,
}

pub type SharedRpcProviders = Arc<RwLock<HashMap<String, Arc<Mutex<RpcProvider>>>>>;
pub type ProvidersMetrics = HashMap<String, Arc<RwLock<ProviderMetrics>>>;

pub async fn init_shared_rpc_providers(
    conf: &SequencerConfig,
    prefix: Option<&str>,
    feeds_config: &AllFeedsConfig,
) -> SharedRpcProviders {
    let prefix = prefix.unwrap_or("");
    let providers = Arc::new(RwLock::new(
        get_rpc_providers(conf, prefix, feeds_config).await,
    ));
    check_contracts_in_networks(&providers).await;
    read_data_from_chains(&providers, feeds_config, conf).await;
    providers
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
            panic!("Failed to read private key for {net} from {priv_key_path}")
        });
        let signer: PrivateKeySigner = priv_key
            .trim()
            .parse()
            .unwrap_or_else(|_| panic!("Incorrect private key specified {priv_key}."));

        let rpc_provider = RpcProvider::new(
            net.as_str(),
            rpc_url,
            &signer,
            p,
            &provider_metrics,
            feeds_config,
        )
        .await;
        let rpc_provider = Arc::new(Mutex::new(rpc_provider));
        providers.insert(net.clone(), rpc_provider);
    }

    debug!("List of providers:");
    for (key, value) in &providers {
        let provider = &value.lock().await.provider;
        debug!("{}: {:?}", key, provider);
    }

    providers
}

async fn check_contracts_in_networks(providers: &SharedRpcProviders) {
    let p = providers.read().await;
    let mut check_contracts_in_networks_tasks = Vec::new();
    for (_, rpc_provider) in p.iter() {
        let contracts = rpc_provider.clone().lock().await.contracts.clone();
        for c in &contracts {
            check_contracts_in_networks_tasks
                .push(log_if_contract_exists(rpc_provider.clone(), c.name.clone()));
        }
    }
    join_all(check_contracts_in_networks_tasks).await;
}

async fn read_data_from_chains(
    providers: &SharedRpcProviders,
    feeds_config: &AllFeedsConfig,
    conf: &SequencerConfig,
) {
    let mut contract_readers_futures = Vec::new();
    for (network, rpc_provider) in providers.read().await.iter() {
        contract_readers_futures.push(load_data_from_chain(
            network.clone(),
            rpc_provider.clone(),
            feeds_config.clone(),
            conf.clone(),
        ));
    }
    join_all(contract_readers_futures).await;
}

async fn load_data_from_chain(
    network: String,
    rpc_provider: Arc<Mutex<RpcProvider>>,
    feeds_config: AllFeedsConfig,
    conf: SequencerConfig,
) {
    let mut provider = rpc_provider.lock().await;
    if conf.should_load_historical_values(network.as_str()) {
        let res = provider.load_history_from_chain().await;
        info!("Loaded history from chain {network} = {res:?}");
    } else {
        warn!("Skipping loading history from chain {network}");
    }
    if conf.should_load_round_counters(network.as_str()) {
        let res = provider.load_round_counters_from_chain(&feeds_config).await;
        match res {
            Ok(mut round_counters) => {
                info!("Loaded round counters from chain {network} = {round_counters:?}");
                for (_id, counter) in round_counters.iter_mut() {
                    *counter = (*counter + 1) % MAX_HISTORY_ELEMENTS_PER_FEED;
                }
                provider.round_counters = round_counters;
            }
            Err(err) => {
                error!("Error when loading round counters for {network} = {err}");
            }
        }
    } else {
        warn!("Skipping loading round conters from chain {network}");
    }
}

async fn log_if_contract_exists(rpc_provider: Arc<Mutex<RpcProvider>>, contract_name: String) {
    rpc_provider
        .lock()
        .await
        .log_if_contract_exists(&contract_name)
        .await
}

#[derive(Debug, Clone, Copy)]
pub struct LatestRound {
    pub feed_id: u128,
    pub round: u16,
}

impl LatestRound {
    pub fn new(feed_id: u128, data: &[u8]) -> LatestRound {
        let l = data.len();
        let round = if l > 1 {
            u16::from_be_bytes([data[l - 2], data[l - 1]])
        } else {
            0_u16
        };
        LatestRound { feed_id, round }
    }

    pub fn calldata(feed_id: u128, stride: u8) -> Bytes {
        let x: U256 = (U256::from(0x81_u8) << 248)
            | (U256::from(stride) << 240)
            | (U256::from(feed_id) << 120);
        let b: [u8; 32] = x.to_be_bytes();
        Bytes::copy_from_slice(&b)
    }
}

#[derive(Clone)]
pub struct FeedVariant {
    pub variant: FeedType,
    pub decimals: usize,
    pub stride: u8,
}

impl RpcProvider {
    pub async fn new(
        network: &str,
        rpc_url: Url,
        signer: &PrivateKeySigner,
        p: &blocksense_config::Provider,
        provider_metrics: &Arc<tokio::sync::RwLock<ProviderMetrics>>,
        feeds_config: &AllFeedsConfig,
    ) -> RpcProvider {
        let provider = ProviderBuilder::new()
            .disable_recommended_fillers()
            .wallet(EthereumWallet::from(signer.clone()))
            .connect_http(rpc_url.clone());

        let impersonated_anvil_account = p
            .impersonated_anvil_account
            .as_ref()
            .and_then(|x| parse_eth_address(x.as_str()));
        let (history, publishing_criteria) = RpcProvider::prepare_history(p);
        let contracts = RpcProvider::prepare_contracts(p).expect("Error in prepare_contracts");
        let mut feeds_variants: HashMap<FeedId, FeedVariant> = HashMap::new();
        for f in feeds_config.feeds.iter() {
            debug!("Registering feed for network; feed={f:?}; network={network}");
            match FeedType::get_variant_from_string(f.value_type.as_str()) {
                Ok(variant) => {
                    feeds_variants.insert(
                        f.id,
                        FeedVariant {
                            variant,
                            decimals: f.additional_feed_info.decimals as usize,
                            stride: f.stride,
                        },
                    );
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
            provider_metrics: provider_metrics.clone(),
            transaction_retries_count_before_give_up: p.transaction_retries_count_before_give_up,
            transaction_retry_timeout_secs: p.transaction_retry_timeout_secs,
            retry_fee_increment_fraction: p.retry_fee_increment_fraction,
            transaction_gas_limit: p.transaction_gas_limit,
            impersonated_anvil_account,
            history,
            publishing_criteria,
            feeds_variants,
            contracts,
            rpc_url,
            round_counters: RoundCounters::new(),
            limit_multicall_data_calls: 16,
            num_tx_in_progress: 0,
        }
    }

    pub async fn load_round_counters_from_chain(
        &mut self,
        feeds_config: &AllFeedsConfig,
    ) -> Result<HashMap<FeedId, u64>> {
        let mut res: HashMap<FeedId, u64> = HashMap::new();

        let adfs_address_opt = self.contracts.iter().find_map(|x| {
            if x.name == ADFS_CONTRACT_NAME {
                x.address
            } else {
                None
            }
        });
        if let Some(adfs_address) = adfs_address_opt {
            for feed in feeds_config.feeds.iter() {
                let feed_id = feed.id;
                if !res.contains_key(&feed_id) {
                    let r = self
                        .get_latest_round_v2_from_storage(adfs_address, &feed_id)
                        .await?;
                    for round in r {
                        if round.round != 0 || round.feed_id == feed_id {
                            let _v = res.insert(round.feed_id, round.round as u64);
                        }
                    }
                }
            }
        }
        Ok(res)
    }

    pub fn prepare_history(
        p: &blocksense_config::Provider,
    ) -> (FeedAggregateHistory, HashMap<FeedId, PublishCriteria>) {
        let mut history = FeedAggregateHistory::new();
        let mut publishing_criteria: HashMap<FeedId, PublishCriteria> = HashMap::new();

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

    pub fn prepare_contracts(p: &blocksense_config::Provider) -> Result<Vec<Contract>> {
        let mut res = vec![];
        for config in &p.contracts {
            res.push(Contract::new(config)?);
        }
        Ok(res)
    }

    pub fn update_history(&mut self, updates: &[VotedFeedUpdate]) {
        for update in updates.iter() {
            let feed_id = update.feed_id;
            self.history
                .push_next(feed_id, update.value.clone(), update.end_slot_timestamp);
        }
    }

    pub fn apply_publish_criteria(&self, updates: &mut BatchedAggregatesToSend, net: &str) {
        let mut res = updates
            .updates
            .iter()
            .filter(|update| {
                self.publishing_criteria
                    .get(&update.feed_id)
                    .is_none_or(|criteria| {
                        !update
                            .should_skip(
                                criteria,
                                &self.history,
                                format!("provider_for_{net}").as_str(),
                            )
                            .get_value()
                    })
            })
            .cloned()
            .collect::<Vec<VotedFeedUpdate>>();
        updates.updates = mem::take(&mut res);
    }

    pub fn get_latest_contract_version(&self, feeds_repeatability: Repeatability) -> u16 {
        match feeds_repeatability {
            Repeatability::Periodic => {
                if self.is_deployed(ADFS_CONTRACT_NAME) {
                    if let Some(contract) = self.get_contract(ADFS_CONTRACT_NAME) {
                        return contract.contract_version;
                    }
                }
                if self.is_deployed(HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME) {
                    if let Some(_v) = self
                        .get_contract(HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME)
                        .map(|x| x.contract_version)
                    {
                        return 1;
                    }
                }
                0
            }
            Repeatability::Oneshot => {
                if self.is_deployed(SPORTS_DATA_FEED_STORE_V2_CONTRACT_NAME) {
                    if let Some(_v) = self
                        .get_contract(SPORTS_DATA_FEED_STORE_V2_CONTRACT_NAME)
                        .map(|x| x.contract_version)
                    {
                        return 1;
                    }
                }
                0
            }
        }
    }

    pub fn get_latest_contract(&self, feeds_repeatability: Repeatability) -> Option<Contract> {
        if self.is_deployed(ADFS_CONTRACT_NAME) {
            if let Some(contract) = self.get_contract(ADFS_CONTRACT_NAME) {
                return Some(contract);
            }
        }
        if self.is_deployed(HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME)
            && feeds_repeatability == Repeatability::Periodic
        {
            return self.get_contract(HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME);
        }
        if self.is_deployed(SPORTS_DATA_FEED_STORE_V2_CONTRACT_NAME)
            && feeds_repeatability == Repeatability::Oneshot
        {
            return self.get_contract(SPORTS_DATA_FEED_STORE_V2_CONTRACT_NAME);
        }
        None
    }

    pub fn peg_stable_coins_to_value(&self, updates: &mut BatchedAggregatesToSend) {
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

    pub fn set_deployed_code(&mut self, name: &str, deployed_code: &Bytes) {
        for c in self.contracts.iter_mut() {
            if c.name == name {
                c.deployed_byte_code = Some(deployed_code.0.to_vec());
            }
        }
    }

    pub fn is_deployed(&self, name: &str) -> bool {
        for c in &self.contracts {
            if c.name == name {
                return c.address.is_some();
            }
        }
        false
    }

    async fn get_latest_round_v2_from_storage(
        &self,
        adfs_address: Address,
        feed_id: &u128,
    ) -> Result<Vec<LatestRound>, eyre::Error> {
        let start_slot = u256!(0x00000000fff00000000000000000000000000000);
        let l = NUM_FEED_IDS_IN_ROUND_RECORD;
        let slot = start_slot + U256::from(feed_id / l);
        let v = self.provider.get_storage_at(adfs_address, slot).await;
        match v {
            Ok(v) => {
                let mut res: Vec<LatestRound> = vec![];
                let data: [u8; 32] = v.to_be_bytes();
                let x = (feed_id / l) * l;
                for i in 0_usize..(l as usize) {
                    let offset = 2 * i;
                    res.push(LatestRound {
                        feed_id: x + i as u128,
                        round: u16::from_be_bytes([data[offset], data[offset + 1]]),
                    });
                }
                Ok(res)
            }
            Err(err) => Err(err.into()),
        }
    }

    pub async fn get_latest_round(&self, feed_id: &u128) -> Result<LatestRound, eyre::Error> {
        let adfs_address = self.get_contract_address(ADFS_CONTRACT_NAME)?;
        let r = self
            .get_latest_round_v2_from_storage(adfs_address, feed_id)
            .await?
            .iter()
            .find(|x| x.feed_id == *feed_id)
            .cloned()
            .ok_or(eyre!("Result not found!?"));
        r
    }

    pub async fn invoke_multicall(&self, calls: &[Multicall::Call]) -> Result<Vec<Bytes>> {
        let multicall = self.get_contract_address(MULTICALL_CONTRACT_NAME)?;
        let contract = MulticallInstance::new(multicall, self.provider.clone());
        let chunk_size = self.limit_multicall_data_calls;
        let chunks: Vec<Vec<Multicall::Call>> =
            calls.chunks(chunk_size).map(|x| x.to_vec()).collect();
        let mut res = vec![];
        for calldata in chunks {
            let mut aggregate_return = contract.aggregate(calldata).call().await?;
            res.append(&mut aggregate_return.returnData);
        }
        Ok(res)
    }

    pub async fn get_latest_values(
        &self,
        feed_ids: &[FeedId],
    ) -> Result<Vec<Result<PublishedFeedUpdate, PublishedFeedUpdateError>>, eyre::Error> {
        let mut variants: Vec<FeedVariant> = vec![];
        for feed_id in feed_ids.iter() {
            let Some(variant) = self.feeds_variants.get(feed_id) else {
                return Err(eyre!(
                    "Unknown variant and number of digits for feed with id = {feed_id}"
                ));
            };
            variants.push(variant.clone());
        }
        type CallDataForValueFnType = fn(u128) -> Bytes;
        type LatestFn = fn(
            u128,
            FeedVariant,
            &[u8],
        )
            -> std::result::Result<PublishedFeedUpdate, PublishedFeedUpdateError>;
        let (data_feed, calldata_for_values, latest) =
            match self.get_latest_contract_version(Repeatability::Periodic) {
                1 => {
                    let data_feed =
                        self.get_contract_address(HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME)?;
                    let calldata_for_value: CallDataForValueFnType = calldata_for_latest_value_v1;
                    let latest: LatestFn = latest_v1;
                    (data_feed, calldata_for_value, latest)
                }

                2 => {
                    let data_feed = self.get_contract_address(ADFS_CONTRACT_NAME)?;
                    let calldata_for_value: CallDataForValueFnType = calldata_for_latest_value_v2;
                    let latest: LatestFn = latest_v2;
                    (data_feed, calldata_for_value, latest)
                }
                _ => {
                    return Err(eyre!(
                        "Unknown contract version when trying to fetch latest values!"
                    ))
                }
            };
        let calldata: Vec<Multicall::Call> = feed_ids
            .iter()
            .map(|feed_id| Multicall::Call {
                target: data_feed,
                callData: calldata_for_values(*feed_id),
            })
            .collect();

        let mutlicall_return_data = self.invoke_multicall(&calldata).await?;
        let res = mutlicall_return_data
            .into_iter()
            .enumerate()
            .map(|(count, data)| latest(feed_ids[count], variants[count].clone(), &data.0))
            .collect();
        Ok(res)
    }

    pub async fn get_historical_values_for_feed(
        &self,
        feed_id: FeedId,
        updates: &[u128],
    ) -> Result<Vec<Result<PublishedFeedUpdate, PublishedFeedUpdateError>>> {
        let Some(variant) = self.feeds_variants.get(&feed_id) else {
            return Err(eyre!(
                "Unknown variant and number of digits for feed with id = {feed_id}"
            ));
        };
        type NthCalldataFn = fn(u128, u8, u128) -> Bytes;
        type NthResultFn = fn(
            u128,
            u128,
            FeedVariant,
            &[u8],
        )
            -> std::result::Result<PublishedFeedUpdate, PublishedFeedUpdateError>;
        let (data_feed, nth_calldata, nth_result) = match self
            .get_latest_contract_version(Repeatability::Periodic)
        {
            1 => {
                let data_feed: Address =
                    self.get_contract_address(HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME)?;
                let nth_calldata: NthCalldataFn = calldata_nth_v1;
                let nth_result: NthResultFn = nth_v1;
                (data_feed, nth_calldata, nth_result)
            }
            2 => {
                let data_feed: Address = self.get_contract_address(ADFS_CONTRACT_NAME)?;
                let nth_calldata: NthCalldataFn = calldata_nth_v2;
                let nth_result: NthResultFn = nth_v2;
                (data_feed, nth_calldata, nth_result)
            }
            _ => {
                return Err(eyre!("Unknown contract version when trying to fetch get_historical_values_for_feed {feed_id}!" ));
            }
        };
        let calldata: Vec<Multicall::Call> = updates
            .iter()
            .map(|update| Multicall::Call {
                target: data_feed,
                callData: Bytes::copy_from_slice(&nth_calldata(feed_id, variant.stride, *update)),
            })
            .collect();

        let mutlicall_return_data = self.invoke_multicall(&calldata).await?;
        let res = mutlicall_return_data
            .into_iter()
            .enumerate()
            .map(|(count, data)| nth_result(feed_id, updates[count], variant.clone(), &data.0))
            .collect();
        Ok(res)
    }

    pub fn get_history_capacity(&self, feed_id: FeedId) -> Option<usize> {
        self.history.get(feed_id).map(|x| x.capacity().get())
    }

    pub fn get_last_update_num_from_history(&self, feed_id: FeedId) -> u128 {
        let default = 0;
        self.history
            .get(feed_id)
            .map_or(default, |x| x.last().map_or(default, |x| x.update_number))
    }

    pub async fn deploy_contract(&mut self, contract_name: &str) -> Result<String> {
        let signer = &self.signer;
        let sender_address = signer.address();
        let provider = &self.provider;
        let provider_metrics = &self.provider_metrics;
        let contract = self
            .get_contract(contract_name)
            .ok_or(eyre!("{contract_name} contract is not set!"))?;
        let timeout_duration = Duration::from_secs(1);
        if let Some(addr) = contract.address {
            let read_byte_code = self.read_contract_bytecode(&addr, timeout_duration).await?;
            let msg = format!(
                "Contract {contract_name} on address {addr} has byte code {read_byte_code}"
            );
            return Ok(msg);
        }
        let mut bytecode = contract.creation_byte_code.ok_or(eyre!(
            "Byte code unavailable to create contract named {contract_name}"
        ))?;

        // Deploy the contract.
        let network = self.network.clone();

        let chain_id = process_provider_getter!(
            provider.get_chain_id().await,
            network,
            provider_metrics,
            get_chain_id
        )?;

        let nonce = provider
            .get_transaction_count(signer.address())
            .pending()
            .await?;

        match contract_name {
            ADFS_CONTRACT_NAME => {
                let access_control_address = self
                    .contracts
                    .iter()
                    .find(|con| con.name == ADFS_ACCESS_CONTROL_CONTRACT_NAME)
                    .and_then(|v| v.address)
                    .unwrap_or_else(|| panic!("{ADFS_ACCESS_CONTROL_CONTRACT_NAME} contract should be deployed before {ADFS_CONTRACT_NAME}"));
                extend_byte_code_with_address(access_control_address, &mut bytecode);
            }
            ADFS_ACCESS_CONTROL_CONTRACT_NAME => {
                extend_byte_code_with_address(sender_address, &mut bytecode);
            }
            HISTORICAL_DATA_FEED_STORE_V2_CONTRACT_NAME => {
                extend_byte_code_with_address(sender_address, &mut bytecode);
            }
            _ => {}
        };

        let gas_fees = match get_tx_retry_params(
            network.as_str(),
            provider,
            provider_metrics,
            &signer.address(),
            30,
            0,
            0.0,
        )
        .await
        {
            Ok(res) => res,
            Err(e) => {
                warn!("Timed out on get_tx_retry_params while deploying contract {contract_name} in network `{network}`: {e}!");
                return Err(eyre!(
                    "failed to get_tx_retry_params for network `{network}"
                ));
            }
        };

        let mut tx = TransactionRequest::default()
            .with_nonce(nonce)
            .with_from(signer.address())
            .with_chain_id(chain_id)
            .with_deploy_code(bytecode);

        let gas_limit = get_gas_limit(
            network.as_str(),
            provider,
            &tx,
            30,
            self.transaction_gas_limit,
        )
        .await;

        tx = tx.with_gas_limit(gas_limit);

        match gas_fees {
            GasFees::Legacy(gas_price) => {
                tx = tx.with_gas_price(gas_price.gas_price).transaction_type(0);
            }
            GasFees::Eip1559(eip1559_gas_fees) => {
                tx = tx
                    .with_max_priority_fee_per_gas(eip1559_gas_fees.priority_fee)
                    .with_max_fee_per_gas(eip1559_gas_fees.max_fee_per_gas);
            }
        }

        let deploy_time = Instant::now();
        let pending_transaction = provider.send_transaction(tx).await?;
        let transaction_reciept = pending_transaction.get_receipt().await?;
        let contract_address = transaction_reciept
            .contract_address
            .ok_or(eyre!("Failed to get contract address"))?;

        info!(
            "Deployed {:?} contract at address: {:?} took {} ms\n",
            contract_name,
            contract_address.to_string(),
            deploy_time.elapsed().as_millis()
        );

        perform_post_deployment_transaction(
            network.as_str(),
            provider,
            provider_metrics,
            contract_name,
            sender_address,
            chain_id,
            contract_address,
            self.transaction_gas_limit,
        )
        .await?;

        self.set_contract_address(contract_name, &contract_address);

        match self
            .read_contract_bytecode(&contract_address, timeout_duration)
            .await
        {
            Ok(read_byte_code) => {
                self.set_deployed_code(contract_name, &read_byte_code);
            }
            Err(e) => {
                error!("Can't read deployed code for contract {contract_name} Error -> {e}");
            }
        };
        Ok(format!("{contract_name} address set to {contract_address}"))
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

    pub async fn read_contract_bytecode(
        &self,
        addr: &Address,
        timeout_duration: Duration,
    ) -> Result<Bytes> {
        Ok(
            actix_web::rt::time::timeout(timeout_duration, self.provider.get_code_at(*addr))
                .await??,
        )
    }

    pub fn url(&self) -> Url {
        self.rpc_url.clone()
    }

    pub async fn log_if_contract_exists(&self, contract_name: &str) {
        let address = self.get_contract_address(contract_name).ok();
        let network = self.network.as_str();
        if let Some(addr) = address {
            let result = self
                .read_contract_bytecode(&addr, Duration::from_secs(5))
                .await;
            match result {
                Ok(byte_code) => {
                    let exists = !byte_code.is_empty();
                    if exists {
                        if let Some(expected_byte_code) = self
                            .get_contract(contract_name)
                            .and_then(|x| x.deployed_byte_code)
                        {
                            let a = byte_code.0.to_vec();
                            let same_byte_code = expected_byte_code.eq(&a);
                            if same_byte_code {
                                info!("Contract {contract_name} exists in network {network} on {addr} matching byte code!");
                            } else {
                                warn!("Contract {contract_name} exists in network {network} on {addr} but bytecode differs! Found {byte_code:?} expected {expected_byte_code:?}");
                            }
                        } else {
                            warn!("Contract {contract_name} exists in network {network} on {addr} and reference code provided");
                        }
                    } else {
                        warn!("Contract {contract_name} not found in network {network} on {addr}");
                    }
                }
                Err(e) => {
                    warn!("JSON rpc request to verify contract existence timed out: {e}");
                }
            };
        } else {
            warn!("Contract {contract_name} no address set for network {network}");
        }
    }

    pub async fn load_history_from_chain_for_feed(
        &mut self,
        feed_id: FeedId,
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

    pub async fn load_history_from_chain(&mut self) -> Result<u32> {
        let mut f: Vec<(FeedId, u32)> = vec![];
        for (feed_id, buff) in &self.history.aggregate_history {
            if buff.occupied_len() == 0 {
                let limit = 128_u32;
                let len = if buff.vacant_len() < limit as usize {
                    buff.vacant_len() as u32
                } else {
                    limit
                };
                f.push((*feed_id, len));
            }
        }
        let mut total = 0_u32;
        for (feed_id, len) in f {
            let entries = self.load_history_from_chain_for_feed(feed_id, len).await?;
            total += entries;
        }
        Ok(total)
    }

    pub fn inc_num_tx_in_progress(&mut self) {
        self.num_tx_in_progress += 1;
    }

    pub fn dec_num_tx_in_progress(&mut self) {
        if self.num_tx_in_progress == 0 {
            error!("Logical error! Trying to reduce the number of tx_in_progress, but there are 0 pending!");
        } else {
            self.num_tx_in_progress -= 1;
        }
    }

    pub fn get_num_tx_in_progress(&self) -> u32 {
        self.num_tx_in_progress
    }
}

#[allow(clippy::too_many_arguments)]
async fn perform_post_deployment_transaction(
    net: &str,
    provider: &ProviderType,
    provider_metrics: &Arc<RwLock<ProviderMetrics>>,
    contract_name: &str,
    sender_address: Address,
    chain_id: u64,
    to_address: Address,
    default_gas_limit: u32,
) -> Result<(), eyre::Error> {
    if contract_name == ADFS_ACCESS_CONTROL_CONTRACT_NAME {
        let input = DynSolValue::Tuple(vec![
            DynSolValue::Address(sender_address),
            DynSolValue::Bool(true),
        ])
        .abi_encode_packed();

        let nonce = provider
            .get_transaction_count(sender_address)
            .pending()
            .await?;

        let gas_fees = match get_tx_retry_params(
            net,
            provider,
            provider_metrics,
            &sender_address,
            5 * 60,
            10,
            0.0,
        )
        .await
        {
            Ok(res) => res,
            Err(e) => {
                eyre::bail!("Timed out on get_tx_retry_params in network `{net}`: {e}!");
            }
        };

        let tx_input = TransactionInput::new(Bytes::from(input));
        let mut tx = TransactionRequest::default()
            .with_nonce(nonce)
            .to(to_address)
            .from(sender_address)
            .with_chain_id(chain_id)
            .input(tx_input);
        //  .with_gas_limit(10_000_000)
        //  .with_max_fee_per_gas(30_000_000_000)
        //  .with_max_priority_fee_per_gas(2_000_000_000);

        let gas_limit = get_gas_limit(net, provider, &tx, 5 * 60, default_gas_limit).await;

        tx = tx.with_gas_limit(gas_limit);

        match gas_fees {
            GasFees::Legacy(gas_price) => {
                tx = tx.with_gas_price(gas_price.gas_price).transaction_type(0);
            }
            GasFees::Eip1559(eip1559_gas_fees) => {
                tx = tx
                    .with_max_priority_fee_per_gas(eip1559_gas_fees.priority_fee)
                    .with_max_fee_per_gas(eip1559_gas_fees.max_fee_per_gas);
            }
        }

        let pending_transaction = provider.send_transaction(tx).await?;
        let transaction_reciept = pending_transaction.get_receipt().await?;
        info!("Performed post deployment transaction reciept = {transaction_reciept:?}");
    };
    Ok(())
}

fn extend_byte_code_with_address(address: Address, bytecode: &mut Vec<u8>) {
    let message_value = DynSolValue::Tuple(vec![DynSolValue::Address(address)]);
    let mut encoded_arg = message_value.abi_encode();
    bytecode.append(&mut encoded_arg);
}
// pub fn print_type<T>(_: &T) {
//     println!("{:?}", std::any::type_name::<T>());
// }

pub fn calldata_nth_v1(feed_id: FeedId, _stride: u8, update: u128) -> Bytes {
    let mut a = [
        (((feed_id >> 24) & 0xFF) | 0x20) as u8,
        ((feed_id >> 16) & 0xFF) as u8,
        ((feed_id >> 8) & 0xFF) as u8,
        (feed_id & 0xFF) as u8,
    ]
    .to_vec();
    a.append(&mut 0_u128.to_be_bytes().to_vec());
    a.append(&mut update.to_be_bytes().to_vec());
    Bytes::copy_from_slice(&a)
}

pub fn calldata_nth_v2(feed_id: FeedId, stride: u8, update: u128) -> Bytes {
    //  ['0x86', stride, feed_id, roundId],
    // abi.encodePacked(bytes1(0x86), stride, uint120(id), uint16(round))
    let call = DynSolValue::Tuple(vec![
        DynSolValue::Uint(U256::from(0x86_u8), 8),
        DynSolValue::Uint(U256::from(stride), 8),
        DynSolValue::Uint(U256::from(feed_id), 120),
        DynSolValue::Uint(U256::from(update), 16),
    ]);
    // PACKED is very important :) !!!
    Bytes::copy_from_slice(&call.abi_encode_packed())
}

pub fn calldata_for_latest_value_v2(feed_id: FeedId) -> Bytes {
    let method_code = U256::from(0x83_u8);
    let x = (method_code << 248) | (U256::from(feed_id) << 120);
    Bytes::copy_from_slice(&DynSolValue::Uint(x, 256).abi_encode())
}

pub fn calldata_for_latest_value_v1(feed_id: FeedId) -> Bytes {
    Bytes::copy_from_slice(&[
        (((feed_id >> 24) & 0xFF) | 0xC0) as u8,
        ((feed_id >> 16) & 0xFF) as u8,
        ((feed_id >> 8) & 0xFF) as u8,
        (feed_id & 0xFF) as u8,
    ])
}

pub fn latest_v1(
    feed_id: FeedId,
    variant: FeedVariant,
    data: &[u8],
) -> Result<PublishedFeedUpdate, PublishedFeedUpdateError> {
    if data.is_empty() {
        return Err(PublishedFeedUpdate::error(
            feed_id,
            "Data shows no published updates on chain",
        ));
    }
    if data.len() != 64 {
        return Err(PublishedFeedUpdate::error(
            feed_id,
            "Data size is not exactly 64 bytes",
        ));
    }
    let j1: [u8; 32] = data[0..32].try_into().expect("Impossible");
    let j2: [u8; 16] = data[48..64].try_into().expect("Impossible");
    let j3: [u8; 8] = data[24..32].try_into().expect("Impossible");
    let timestamp_u64 = u64::from_be_bytes(j3);
    match FeedType::from_bytes(j1.to_vec(), variant.variant, variant.decimals) {
        Ok(latest) => Ok(PublishedFeedUpdate {
            feed_id,
            num_updates: u128::from_be_bytes(j2),
            value: latest,
            published: timestamp_u64 as u128,
        }),
        Err(msg) => Err(PublishedFeedUpdate::error(feed_id, &msg)),
    }
}

pub fn latest_v2(
    feed_id: FeedId,
    variant: FeedVariant,
    data: &[u8],
) -> Result<PublishedFeedUpdate, PublishedFeedUpdateError> {
    if data.is_empty() {
        return Err(PublishedFeedUpdate::error(
            feed_id,
            "Data shows no published updates on chain",
        ));
    }
    if data.len() != 64 {
        return Err(PublishedFeedUpdate::error(
            feed_id,
            "Data size is not exactly 64 bytes",
        ));
    }
    let value_bytes: [u8; 32] = data[32..64].try_into().expect("Impossible");
    let update_bytes: [u8; 16] = data[16..32].try_into().expect("Impossible");
    let timestamp_bytes: [u8; 16] = data[0..16].try_into().expect("Impossible");
    let timestamp = u128::from_be_bytes(timestamp_bytes);
    match FeedType::from_bytes(value_bytes.to_vec(), variant.variant, variant.decimals) {
        Ok(latest) => Ok(PublishedFeedUpdate {
            feed_id,
            num_updates: u128::from_be_bytes(update_bytes),
            value: latest,
            published: timestamp,
        }),
        Err(msg) => Err(PublishedFeedUpdate::error(feed_id, &msg)),
    }
}

fn nth_v1(
    feed_id: FeedId,
    num_updates: u128,
    variant: FeedVariant,
    data: &[u8],
) -> Result<PublishedFeedUpdate, PublishedFeedUpdateError> {
    if data.len() != 32 {
        return Err(PublishedFeedUpdate::error_num_update(
            feed_id,
            "Data size is not exactly 32 bytes",
            num_updates,
        ));
    }
    let j3: [u8; 8] = data[24..32].try_into().expect("Impossible");
    let timestamp_u64 = u64::from_be_bytes(j3);
    if timestamp_u64 == 0 {
        return Err(PublishedFeedUpdate::error_num_update(
            feed_id,
            "Timestamp is zero",
            num_updates,
        ));
    }
    let j1: [u8; 32] = data[0..32].try_into().expect("Impossible");
    match FeedType::from_bytes(j1.to_vec(), variant.variant, variant.decimals) {
        Ok(value) => Ok(PublishedFeedUpdate {
            feed_id,
            num_updates,
            value,
            published: timestamp_u64 as u128,
        }),
        Err(msg) => Err(PublishedFeedUpdate::error_num_update(
            feed_id,
            &msg,
            num_updates,
        )),
    }
}

fn nth_v2(
    feed_id: FeedId,
    num_updates: u128,
    variant: FeedVariant,
    data: &[u8],
) -> Result<PublishedFeedUpdate, PublishedFeedUpdateError> {
    if data.len() != 32 {
        return Err(PublishedFeedUpdate::error_num_update(
            feed_id,
            "Data size is not exactly 32 bytes",
            num_updates,
        ));
    }
    info!("nth_v2 {num_updates} {data:?}");
    let j3: [u8; 8] = data[0..8].try_into().expect("Impossible");
    let timestamp_u64 = u64::from_be_bytes(j3);
    // if timestamp_u64 == 0 {
    //     return Err(PublishedFeedUpdate::error_num_update(
    //         feed_id,
    //         "Timestamp is zero",
    //         num_updates,
    //     ));
    // }
    let j1: [u8; 32] = data[0..32].try_into().expect("Impossible");
    match FeedType::from_bytes(j1.to_vec(), variant.variant, variant.decimals) {
        Ok(value) => Ok(PublishedFeedUpdate {
            feed_id,
            num_updates,
            value,
            published: timestamp_u64 as u128,
        }),
        Err(msg) => Err(PublishedFeedUpdate::error_num_update(
            feed_id,
            &msg,
            num_updates,
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy::{
        network::TransactionBuilder, node_bindings::Anvil, primitives::U256,
        rpc::types::eth::request::TransactionRequest,
    };
    use alloy_primitives::address;
    use blocksense_registry::config::FeedConfig;
    use blocksense_utils::test_env::get_test_private_key_path;
    use tracing::info_span;

    use crate::providers::eth_send_utils::eth_batch_send_to_all_contracts;
    use crate::providers::provider::get_rpc_providers;
    use crate::sequencer_state::create_sequencer_state_and_collected_futures;
    use alloy::consensus::Transaction;
    use alloy::providers::Provider as AlloyProvider;
    use blocksense_config::{
        get_test_config_with_single_provider, test_feed_config, ADFS_ACCESS_CONTROL_CONTRACT_NAME,
    };
    use blocksense_feed_registry::types::Repeatability::Periodic;
    use std::time::UNIX_EPOCH;

    // Common setup reused by multiple tests interacting with ADFS
    async fn setup_adfs_test_env(
        network: &str,
        metrics_prefix: &str,
        feed_id: FeedId,
        stride: u8,
    ) -> Result<(
        SequencerConfig,
        AllFeedsConfig,
        actix_web::web::Data<crate::sequencer_state::SequencerState>,
        futures_util::stream::FuturesUnordered<tokio::task::JoinHandle<Result<(), std::io::Error>>>,
        Arc<Mutex<RpcProvider>>,
        alloy::primitives::Address,
        alloy::primitives::Address,
        String,
        alloy::node_bindings::AnvilInstance,
    )> {
        let anvil = alloy::node_bindings::Anvil::new().try_spawn()?;

        let key_path = blocksense_utils::test_env::get_test_private_key_path();

        let mut sequencer_config = blocksense_config::get_test_config_with_single_provider(
            network,
            key_path.as_path(),
            &anvil.endpoint(),
        );

        let feeds: Vec<FeedConfig> = (16..32)
            .map(|fid| blocksense_config::test_feed_config(fid, stride))
            .collect();
        let feeds_config = AllFeedsConfig { feeds };

        let p_entry = sequencer_config.providers.entry(network.to_string());
        p_entry.and_modify(|p| {
            p.should_load_historical_values = true;
            p.should_load_round_counters = true;
            if let Some(x) = p
                .contracts
                .iter_mut()
                .find(|x| x.name == MULTICALL_CONTRACT_NAME)
            {
                x.address = None;
                x.creation_byte_code = Some(Multicall::BYTECODE.to_string());
            }
        });

        let (sequencer_state, collected_futures) = create_sequencer_state_and_collected_futures(
            sequencer_config.clone(),
            metrics_prefix,
            feeds_config.clone(),
        )
        .await;

        let msg = sequencer_state
            .deploy_contract(network, ADFS_ACCESS_CONTROL_CONTRACT_NAME)
            .await
            .expect("ADFS access control contract deployment failed!");
        info!("{msg}");
        let msg = sequencer_state
            .deploy_contract(network, ADFS_CONTRACT_NAME)
            .await
            .expect("Data feed publishing contract deployment failed!");
        info!("{msg}");
        let msg = sequencer_state
            .deploy_contract(network, MULTICALL_CONTRACT_NAME)
            .await
            .expect("Error when deploying multicall contract!");
        info!("{msg}");

        let rpc_provider_mutex = sequencer_state.get_provider(network).await.clone().unwrap();
        let (adfs_address, multicall_address, adfs_deployed_byte_code) = {
            let mut rpc_provider = rpc_provider_mutex.lock().await;
            rpc_provider.history.register_feed(feed_id, 100);
            let contract_version = rpc_provider.get_latest_contract_version(Periodic);
            assert_eq!(contract_version, 2);

            let block_number = rpc_provider.provider.get_block_number().await.unwrap();
            let block_num_at_time_of_writing_this_test = 0_u64;
            assert!(block_number > block_num_at_time_of_writing_this_test);
            let last_round = rpc_provider.get_latest_round(&feed_id).await.unwrap();
            assert_eq!(last_round.feed_id, feed_id);
            assert_eq!(last_round.round, 0);
            (
                rpc_provider
                    .get_contract(ADFS_CONTRACT_NAME)
                    .unwrap()
                    .address
                    .unwrap(),
                rpc_provider
                    .get_contract(MULTICALL_CONTRACT_NAME)
                    .unwrap()
                    .address
                    .unwrap(),
                blocksense_utils::to_hex_string(
                    rpc_provider
                        .get_contract(ADFS_CONTRACT_NAME)
                        .unwrap()
                        .deployed_byte_code
                        .unwrap(),
                    None,
                ),
            )
        };

        Ok((
            sequencer_config,
            feeds_config,
            sequencer_state,
            collected_futures,
            rpc_provider_mutex,
            adfs_address,
            multicall_address,
            adfs_deployed_byte_code,
            anvil,
        ))
    }

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
            .with_gas_limit(10_000_000)
            .with_max_fee_per_gas(30_000_000_000)
            .with_max_priority_fee_per_gas(2_000_000_000)
            .with_nonce(0)
            // It is required to set the chain_id for EIP-1559 transactions.
            .with_chain_id(anvil.chain_id());

        // Send the transaction, the nonce (0) is automatically managed by the provider.
        let builder = provider.send_transaction(tx).await?;
        let node_hash = *builder.tx_hash();
        let pending_tx = provider.get_transaction_by_hash(node_hash).await?.unwrap();
        assert_eq!(pending_tx.nonce(), 0);

        let receipt = builder.get_receipt().await.unwrap();

        assert_eq!(receipt.effective_gas_price, 3000000000);
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
        let provider = ProviderBuilder::new().connect_anvil_with_wallet();

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

    #[tokio::test]
    async fn test_reading_adfs_counters_and_values() -> Result<()> {
        let metrics_prefix = "test_reading_adfs_counters_and_values";

        let span = info_span!("test_reading_adfs_counters_and_values");
        let _guard = span.enter();

        let network = "ETH4378";
        let feed_id = 31;
        let stride = 0;
        let (
            sequencer_config,
            feeds_config,
            sequencer_state,
            collected_futures,
            rpc_provider_mutex,
            adfs_address,
            multicall_address,
            adfs_deployed_byte_code,
            _anvil,
        ) = setup_adfs_test_env(network, metrics_prefix, feed_id, stride).await?;
        let feed = test_feed_config(feed_id, stride);
        // Some arbitrary point in time in the past, nothing special about this value
        let first_report_start_time = UNIX_EPOCH + Duration::from_secs(1524885322);
        let end_slot_timestamp = first_report_start_time.elapsed().unwrap().as_millis();
        let interval_ms = feed.schedule.interval_ms as u128;

        {
            let v1 = VotedFeedUpdate {
                feed_id: feed.id,
                value: FeedType::Numerical(103082.01f64),
                end_slot_timestamp: end_slot_timestamp + interval_ms,
            };
            let v2 = VotedFeedUpdate {
                feed_id: feed.id,
                value: FeedType::Numerical(103012.21f64),
                end_slot_timestamp: end_slot_timestamp + interval_ms * 2,
            };

            let v3 = VotedFeedUpdate {
                feed_id: feed.id,
                value: FeedType::Numerical(104011.78f64),
                end_slot_timestamp: end_slot_timestamp + interval_ms * 3,
            };

            let updates1 = BatchedAggregatesToSend {
                block_height: 1,
                updates: vec![v1],
            };
            let updates2 = BatchedAggregatesToSend {
                block_height: 2,
                updates: vec![v2],
            };
            let updates3 = BatchedAggregatesToSend {
                block_height: 3,
                updates: vec![v3],
            };

            let p1 = eth_batch_send_to_all_contracts(
                &sequencer_state,
                &updates1,
                Repeatability::Periodic,
                None,
            )
            .await;
            assert!(p1.is_ok());

            let p2 = eth_batch_send_to_all_contracts(
                &sequencer_state,
                &updates2,
                Repeatability::Periodic,
                None,
            )
            .await;
            assert!(p2.is_ok());

            let p3 = eth_batch_send_to_all_contracts(
                &sequencer_state,
                &updates3,
                Repeatability::Periodic,
                None,
            )
            .await;
            assert!(p3.is_ok());
        }

        tokio::time::sleep(Duration::from_millis(2000)).await;

        {
            let rpc_provider = rpc_provider_mutex.lock().await;
            let contract_version = rpc_provider.get_latest_contract_version(Periodic);
            assert_eq!(contract_version, 2);

            let block_number = rpc_provider.provider.get_block_number().await.unwrap();
            let block_num_at_time_of_writing_this_test = 3_u64;
            assert!(block_number > block_num_at_time_of_writing_this_test);

            let last_values = rpc_provider.get_latest_values(&[feed_id]).await;
            info!("last_values = {last_values:?}");

            let last_round = rpc_provider.get_latest_round(&feed_id).await.unwrap();
            assert_eq!(last_round.feed_id, feed_id);
            assert_eq!(last_round.round, 2)
        }
        // Wait for all threads to JOIN
        for x in collected_futures.iter() {
            info!("Aborting future = {:?}", x.id());
            x.abort();
        }
        // this simulates a second boot of the sequencer
        // contracts are already deployed
        let mut sequencer_config2 = sequencer_config.clone();
        let p_entry = sequencer_config2.providers.entry(network.to_string());
        p_entry.and_modify(|p| {
            if let Some(x) = p
                .contracts
                .iter_mut()
                .find(|x| x.name == MULTICALL_CONTRACT_NAME)
            {
                x.address = Some(multicall_address.to_string());
            }
            if let Some(x) = p
                .contracts
                .iter_mut()
                .find(|x| x.name == ADFS_CONTRACT_NAME)
            {
                x.address = Some(adfs_address.to_string());
                x.deployed_byte_code = Some(adfs_deployed_byte_code)
            }
            p.publishing_criteria.push(PublishCriteria {
                feed_id,
                skip_publish_if_less_then_percentage: 0.5,
                always_publish_heartbeat_ms: Some(864000),
                peg_to_value: None,
                peg_tolerance_percentage: 0.5,
            });
        });

        let metrics_prefix2 = "test_reading_adfs_counters_and_values2";
        let new_rpc_providers =
            init_shared_rpc_providers(&sequencer_config2, Some(metrics_prefix2), &feeds_config)
                .await;
        {
            let new_rpc_provider = new_rpc_providers
                .read()
                .await
                .get(network)
                .cloned()
                .unwrap();
            let provider = new_rpc_provider.lock().await;
            let counters = &provider.round_counters;
            assert_eq!(Some(3), counters.get(&feed_id).copied());

            let x = provider.get_latest_values(&[feed_id]).await.unwrap();
            assert_eq!(x.len(), 1);
            let v = x[0].clone().unwrap();
            assert_eq!(v.num_updates, 2);
            assert_eq!(v.value, FeedType::Numerical(104011.78f64));

            {
                let metrics_prefix3 = "test_reading_adfs_counters_and_values3";

                let (sequencer_state, collected_futures) =
                    create_sequencer_state_and_collected_futures(
                        sequencer_config2.clone(),
                        metrics_prefix3,
                        feeds_config.clone(),
                    )
                    .await;

                let v = provider.history.get(feed_id).unwrap();
                let v = v.last().unwrap();
                assert_eq!(v.update_number, 2);
                assert_eq!(v.value, FeedType::Numerical(104011.78f64));

                // publish new update
                let v4 = VotedFeedUpdate {
                    feed_id: feed.id,
                    value: FeedType::Numerical(94011.11f64),
                    end_slot_timestamp: end_slot_timestamp + interval_ms * 4,
                };
                let updates4 = BatchedAggregatesToSend {
                    block_height: 4,
                    updates: vec![v4],
                };

                let p4 = eth_batch_send_to_all_contracts(
                    &sequencer_state,
                    &updates4,
                    Repeatability::Periodic,
                    None,
                )
                .await;

                assert!(p4.is_ok());
                tokio::time::sleep(Duration::from_millis(2000)).await;

                let prov = sequencer_state.providers.read().await;
                let p = prov.get(network).unwrap();
                let round = p.lock().await.get_latest_round(&feed_id).await.unwrap();

                assert_eq!(round.round, 3);
                let x = p
                    .lock()
                    .await
                    .get_historical_values_for_feed(feed_id, &[0, 1, 2, 3])
                    .await
                    .unwrap();
                assert_eq!(x.len(), 4);
                {
                    let v = x[0].clone().unwrap();
                    assert_eq!(v.num_updates, 0);
                    assert_eq!(v.value, FeedType::Numerical(103082.01f64));
                }
                {
                    let v = x[1].clone().unwrap();
                    assert_eq!(v.num_updates, 1);
                    assert_eq!(v.value, FeedType::Numerical(103012.21f64));
                }
                {
                    let v = x[2].clone().unwrap();
                    assert_eq!(v.num_updates, 2);
                    assert_eq!(v.value, FeedType::Numerical(104011.78f64));
                }
                {
                    // THIS UPDATE should come from the restarted sequencer_state :)
                    let v = x[3].clone().unwrap();
                    assert_eq!(v.num_updates, 3);
                    assert_eq!(v.value, FeedType::Numerical(94011.11f64));
                }
                // Wait for all threads to JOIN
                for x in collected_futures.iter() {
                    info!("Aborting future = {:?}", x.id());
                    x.abort();
                }
            }
        }

        Ok(())
    }

    #[tokio::test]
    async fn test_recover_after_read_overflowed_rb_index_value() -> Result<()> {
        let round_counter_val = 9111;
        let wrapped_val = round_counter_val % MAX_HISTORY_ELEMENTS_PER_FEED as u16 + 1;

        let metrics_prefix = "test_recover_after_read_overflowed_rb_index_value";

        let span = info_span!("test_recover_after_read_overflowed_rb_index_value");
        let _guard = span.enter();

        let network = "ETH4380";
        let feed_id = 31;
        let stride = 0;
        let (
            sequencer_config,
            feeds_config,
            _sequencer_state,
            collected_futures,
            rpc_provider_mutex,
            adfs_address,
            multicall_address,
            adfs_deployed_byte_code,
            anvil,
        ) = setup_adfs_test_env(network, metrics_prefix, feed_id, stride).await?;

        // Write raw calldata to ADFS before any updates are made.
        {
            use alloy::hex::FromHex;
            // Provided calldata to pre-populate counters/values
            let calldata_hex = "0x01000000000000000100000001000303e3970120000000000000000000000000000015d41642f71aa02900000000003647f7d78101010000000000000000000000000000000000000000000000000000000000002397";

            let pre_data: Bytes = Bytes::from_hex(calldata_hex).expect("Invalid calldata hex");

            let p = rpc_provider_mutex.lock().await;
            let signer = p.signer.clone();
            let provider = &p.provider;

            // Get current nonce for the signer
            let nonce = provider
                .get_transaction_count(signer.address())
                .pending()
                .await
                .expect("Failed to get nonce");

            let mut tx = TransactionRequest::default()
                .to(adfs_address)
                .with_nonce(nonce)
                .with_from(signer.address())
                .with_chain_id(anvil.chain_id())
                .input(TransactionInput::from(pre_data.clone()));

            // Be explicit with gas to avoid missing fillers
            tx = tx
                .with_gas_limit(10_000_000)
                .with_max_fee_per_gas(30_000_000_000)
                .with_max_priority_fee_per_gas(2_000_000_000);

            let pending_tx = provider.send_transaction(tx).await.expect("send tx");
            let receipt = pending_tx.get_receipt().await.expect("get receipt");
            info!("Receipt = {receipt:?}");
            let last_round = p.get_latest_round(&feed_id).await.unwrap();
            assert_eq!(last_round.feed_id, feed_id);
            assert_eq!(last_round.round, round_counter_val);
        }

        // Some arbitrary point in time in the past, nothing special about this value
        let first_report_start_time = UNIX_EPOCH + Duration::from_secs(1524885322);
        let end_slot_timestamp = first_report_start_time.elapsed().unwrap().as_millis();
        let interval_ms = (test_feed_config(feed_id, stride).schedule.interval_ms) as u128;

        // Wait for all threads to JOIN
        for x in collected_futures.iter() {
            info!("Aborting future = {:?}", x.id());
            x.abort();
        }
        // this simulates a second boot of the sequencer
        // contracts are already deployed
        let mut sequencer_config2 = sequencer_config.clone();
        let p_entry = sequencer_config2.providers.entry(network.to_string());
        p_entry.and_modify(|p| {
            if let Some(x) = p
                .contracts
                .iter_mut()
                .find(|x| x.name == MULTICALL_CONTRACT_NAME)
            {
                x.address = Some(multicall_address.to_string());
            }
            if let Some(x) = p
                .contracts
                .iter_mut()
                .find(|x| x.name == ADFS_CONTRACT_NAME)
            {
                x.address = Some(adfs_address.to_string());
                x.deployed_byte_code = Some(adfs_deployed_byte_code)
            }
            p.publishing_criteria.push(PublishCriteria {
                feed_id,
                skip_publish_if_less_then_percentage: 0.5,
                always_publish_heartbeat_ms: Some(864000),
                peg_to_value: None,
                peg_tolerance_percentage: 0.5,
            });
        });

        let metrics_prefix2 = "test_recover_after_read_overflowed_rb_index_value_2";
        let new_rpc_providers =
            init_shared_rpc_providers(&sequencer_config2, Some(metrics_prefix2), &feeds_config)
                .await;
        {
            let new_rpc_provider = new_rpc_providers
                .read()
                .await
                .get(network)
                .cloned()
                .unwrap();
            let provider = new_rpc_provider.lock().await;
            let counters = &provider.round_counters;
            assert_eq!(Some(wrapped_val as u64), counters.get(&feed_id).copied());

            let x = provider.get_latest_values(&[feed_id]).await.unwrap();
            assert_eq!(x.len(), 1);
            let v = x[0].clone().unwrap();
            assert_eq!(v.num_updates, round_counter_val.into());

            {
                let metrics_prefix3 = "test_recover_after_read_overflowed_rb_index_value_3";

                let (sequencer_state, collected_futures) =
                    create_sequencer_state_and_collected_futures(
                        sequencer_config2.clone(),
                        metrics_prefix3,
                        feeds_config.clone(),
                    )
                    .await;

                // publish new update
                let new_update = FeedType::Numerical(94011.11f64);
                let v1 = VotedFeedUpdate {
                    feed_id,
                    value: new_update.clone(),
                    end_slot_timestamp: end_slot_timestamp + interval_ms * 4,
                };
                let updates1 = BatchedAggregatesToSend {
                    block_height: 4,
                    updates: vec![v1],
                };

                let p1 = eth_batch_send_to_all_contracts(
                    &sequencer_state,
                    &updates1,
                    Repeatability::Periodic,
                    None,
                )
                .await;

                assert!(p1.is_ok());
                tokio::time::sleep(Duration::from_millis(2000)).await;

                let prov = sequencer_state.providers.read().await;
                let p = prov.get(network).unwrap();
                let round = p.lock().await.get_latest_round(&feed_id).await.unwrap();
                let vals = p
                    .lock()
                    .await
                    .get_latest_values(&[feed_id])
                    .await
                    .expect("Could not get latest value");
                let val = vals[0]
                    .as_ref()
                    .expect("Expected correct value in contract for feed id {feed_id}");

                // Assert that the value of the round counter in the contract is as expected.
                // Note: The sequencer tracks the index of the *next* slot to write,
                // while the contract stores the index of the *last* written value.
                assert_eq!(round.round, wrapped_val);

                assert_eq!(val.value, new_update);

                // Wait for all threads to JOIN
                for x in collected_futures.iter() {
                    info!("Aborting future = {:?}", x.id());
                    x.abort();
                }
            }
        }

        Ok(())
    }
}
