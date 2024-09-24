use alloy::providers::Provider;
use alloy::transports::http::Http;
use alloy::{
    hex,
    network::{Ethereum, EthereumSigner},
    primitives::Address,
    providers::{
        fillers::{ChainIdFiller, FillProvider, GasFiller, JoinFill, NonceFiller, SignerFiller},
        Identity, ProviderBuilder, RootProvider,
    },
    signers::wallet::LocalWallet,
};
use reqwest::{Client, Url};

use prometheus::metrics::ProviderMetrics;
use sequencer_config::SequencerConfig;
use std::collections::HashMap;
use std::fs;
use std::sync::Arc;
use tokio::spawn;
use tokio::sync::{Mutex, RwLock};
use tokio::time::Duration;
use tracing::{debug, error, info, warn};

pub type ProviderType = FillProvider<
    JoinFill<
        JoinFill<JoinFill<JoinFill<Identity, GasFiller>, NonceFiller>, ChainIdFiller>,
        SignerFiller<EthereumSigner>,
    >,
    RootProvider<Http<Client>>,
    Http<Client>,
    Ethereum,
>;

pub fn parse_contract_address(addr: &str) -> Option<Address> {
    let contract_address: Option<Address> = addr.parse().ok();
    contract_address
}

#[derive(Debug)]
pub struct RpcProvider {
    pub name: String,
    pub providers: Vec<ProviderType>,
    pub chain_id: u64,
    pub wallet: LocalWallet,
    pub contract_address: Option<Address>,
    pub event_contract_address: Option<Address>,
    pub provider_metrics: Arc<RwLock<ProviderMetrics>>,
    pub transcation_timeout_secs: u32,
    pub data_feed_store_byte_code: Option<Vec<u8>>,
    pub data_feed_sports_byte_code: Option<Vec<u8>>,
    pub active_provider_index: u32,
}

impl RpcProvider {
    pub fn get_current_provider(&self) -> &ProviderType {
        self.providers
            .get(self.active_provider_index as usize)
            .expect("active_provider index out of bounds!")
    }
    pub fn switch_provider(&mut self) {
        if self.providers.is_empty() {
            error!("No providers set for network: {}", self.name);
            return;
        } else if self.providers.len() == 1 {
            warn!("No fallback providers set for network: {}", self.name);
            return;
        }
        self.active_provider_index = (self.active_provider_index + 1) % self.providers.len() as u32;
    }
}

pub type SharedRpcProviders = Arc<RwLock<HashMap<String, Arc<Mutex<RpcProvider>>>>>;

pub async fn can_read_contract_bytecode(provider: Arc<Mutex<RpcProvider>>, addr: &Address) -> bool {
    let latest_block = match provider
        .lock()
        .await
        .get_current_provider()
        .get_block_number()
        .await
    {
        Ok(result) => result,
        Err(e) => {
            error!("Could not get block number: {}", e);
            return false;
        }
    };
    let bytecode = match provider
        .lock()
        .await
        .get_current_provider()
        .get_code_at(*addr, latest_block.into())
        .await
    {
        Ok(result) => result,
        Err(e) => {
            error!("Could not get bytecode of contract: {}", e);
            return false;
        }
    };
    bytecode.to_string() != "0x"
}

pub async fn init_shared_rpc_providers(
    conf: &SequencerConfig,
    prefix: Option<&str>,
) -> SharedRpcProviders {
    let prefix = prefix.unwrap_or("");
    Arc::new(RwLock::new(get_rpc_providers(conf, prefix).await))
}

async fn verify_contract_exists(
    key: &str,
    address: &Option<String>,
    rpc_provider: Arc<Mutex<RpcProvider>>,
) {
    if let Some(addr_str) = address {
        if let Some(addr) = parse_contract_address(addr_str.as_str()) {
            info!(
                "Contract address for network {} set to {}. Checking if contract exists ...",
                key, addr
            );
            match spawn(async move {
                actix_web::rt::time::timeout(
                    Duration::from_secs(5),
                    can_read_contract_bytecode(rpc_provider, &addr),
                )
                .await
            })
            .await
            {
                Ok(result) => match result {
                    Ok(exists) => {
                        if exists {
                            info!("Contract for network {} exists on address {}", key, addr);
                        } else {
                            warn!("No contract for network {} exists on address {}", key, addr);
                        }
                    }
                    Err(e) => {
                        warn!(
                            "JSON rpc request to verify contract existence timed out: {}",
                            e
                        );
                    }
                },
                Err(e) => {
                    error!("Task join error: {}", e)
                }
            };
        } else {
            error!(
                "Set contract address for network {} is not a valid Ethereum contract address!",
                key
            );
        }
    } else {
        warn!("No contract address set for network {}", key);
    }
}

async fn get_rpc_providers(
    conf: &SequencerConfig,
    prefix: &str,
) -> HashMap<String, Arc<Mutex<RpcProvider>>> {
    let mut rpc_providers: HashMap<String, Arc<Mutex<RpcProvider>>> = HashMap::new();

    let provider_metrics = Arc::new(RwLock::new(
        ProviderMetrics::new(prefix).expect("Failed to allocate ProviderMetrics"),
    ));

    for (key, p) in &conf.providers {
        let rpc_urls: Vec<Url> = p
            .urls
            .clone()
            .into_iter()
            .map(|url| {
                url.parse()
                    .unwrap_or_else(|_| panic!("Not a valid url provided for {key}!"))
            })
            .collect();

        let priv_key_path = &p.private_key_path;
        let priv_key = fs::read_to_string(priv_key_path.clone()).unwrap_or_else(|_| {
            panic!(
                "Failed to read private key for {} from {}",
                key, priv_key_path
            )
        });
        let wallet: LocalWallet = priv_key
            .trim()
            .parse()
            .unwrap_or_else(|_| panic!("Incorrect private key specified {}.", priv_key));
        let providers: Vec<ProviderType> = rpc_urls
            .into_iter()
            .map(|url| {
                ProviderBuilder::new()
                    .with_recommended_fillers()
                    .signer(EthereumSigner::from(wallet.clone()))
                    .on_http(url)
            })
            .collect();

        let address = match &p.contract_address {
            Some(x) => parse_contract_address(x.as_str()),
            None => None,
        };
        let event_address = match &p.event_contract_address {
            Some(x) => parse_contract_address(x.as_str()),
            None => None,
        };

        let rpc_provider = Arc::new(Mutex::new(RpcProvider {
            name: key.clone(),
            contract_address: address,
            event_contract_address: event_address,
            providers,
            chain_id: p.chain_id,
            wallet,
            provider_metrics: provider_metrics.clone(),
            transcation_timeout_secs: p.transcation_timeout_secs,
            data_feed_store_byte_code: p.data_feed_store_byte_code.clone().map(|byte_code| {
                hex::decode(byte_code.clone())
                    .expect("data_feed_store_byte_code for provider is not valid hex string!")
            }),
            data_feed_sports_byte_code: p.data_feed_sports_byte_code.clone().map(|byte_code| {
                hex::decode(byte_code.clone())
                    .expect("data_feed_sports_byte_code for provider is not valid hex string!")
            }),
            active_provider_index: 0,
        }));

        rpc_providers.insert(key.clone(), rpc_provider.clone());

        // Verify contract_address
        // If contract does not exist statements are logged and the process continues
        verify_contract_exists(key, &p.contract_address, rpc_provider.clone()).await;

        // Verify event_contract_address
        // If contract does not exist statements are logged and the process continues
        verify_contract_exists(key, &p.event_contract_address, rpc_provider.clone()).await;
    }

    debug!("List of providers:");
    for (key, value) in &rpc_providers {
        debug!("{}: {:?}", key, value);
    }

    rpc_providers
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
    use eyre::Result;

    use crate::providers::provider::get_rpc_providers;
    use alloy::providers::Provider as AlloyProvider;
    use sequencer_config::{
        get_test_config_with_single_provider,
        get_test_config_with_single_provider_multiple_fallbacks,
    };

    use tokio::fs::File;
    use tokio::io::AsyncWriteExt;

    async fn create_priv_key(key_path: &str, private_key: &[u8]) {
        let mut f = File::create(key_path)
            .await
            .expect("Could not create key file");
        f.write(private_key)
            .await
            .expect("Failed to write to temp file");
        f.flush().await.expect("Could not flush temp file");
    }

    #[tokio::test]
    async fn basic_test_provider() -> Result<()> {
        let network = "ETH";

        let anvil = Anvil::new().try_spawn()?;

        let cfg = get_test_config_with_single_provider(network, "/tmp/key", &anvil.endpoint());

        let providers = get_rpc_providers(&cfg, "basic_test_provider_").await;
        let provider = &providers.get(network).unwrap().lock().await;
        let provider = provider.get_current_provider();

        let alice = anvil.addresses()[7];
        let bob = anvil.addresses()[0];

        let tx = TransactionRequest::default()
            .with_from(alice)
            .with_to(bob)
            .with_value(U256::from(100))
            // Notice that without the `GasEstimatorLayer`, you need to set the gas related fields.
            .with_gas_limit(21000_u128)
            .with_max_fee_per_gas(20e9 as u128)
            .with_max_priority_fee_per_gas(1e9 as u128)
            // It is required to set the chain_id for EIP-1559 transactions.
            .with_chain_id(anvil.chain_id());

        // Send the transaction, the nonce (0) is automatically managed by the provider.
        let builder = provider.send_transaction(tx.clone()).await?;
        let node_hash = *builder.tx_hash();
        let pending_tx = provider.get_transaction_by_hash(node_hash).await?;
        assert_eq!(pending_tx.nonce, 0);

        println!("Transaction sent with nonce: {}", pending_tx.nonce);

        // Send the transaction, the nonce (1) is automatically managed by the provider.
        let _builder = provider.send_transaction(tx).await?;
        Ok(())
    }

    #[tokio::test]
    async fn test_get_wallet_success() {
        let network = "ETH1";
        // Create a temporary file with a valid private key
        let private_key = b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356";
        let expected_wallet_address = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"; // generated as hash of private_key
        let key_path = "/tmp/key";

        create_priv_key(key_path, private_key).await;

        let cfg = get_test_config_with_single_provider(network, key_path, "http://localhost:8545");
        let providers = get_rpc_providers(&cfg, "test_get_wallet_success_").await;

        // Call the function
        let wallet = &providers[network].lock().await.wallet;

        // Check if the wallet's address matches the expected address
        assert_eq!(wallet.address().to_string(), expected_wallet_address);
    }

    #[tokio::test]
    async fn test_get_rpc_providers_returns_single_provider() {
        // setup
        let network = "ETH2";
        // Create a temporary file with a valid private key
        let private_key = b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356";
        let key_path = "/tmp/key";

        create_priv_key(key_path, private_key).await;

        let cfg = get_test_config_with_single_provider(network, key_path, "http://localhost:8545");

        // test
        let binding = init_shared_rpc_providers(
            &cfg,
            Some("test_get_rpc_providers_returns_single_provider_"),
        )
        .await;
        let result = binding.read().await;

        // assert
        assert_eq!(result.len(), 1);
    }

    #[tokio::test]
    async fn test_iterate_over_fallback_urls() {
        // setup
        let network = "ETH1";
        let urls = vec![
            "http://localhost:8545".to_string(),
            "http://localhost:8546".to_string(),
            "http://localhost:8547".to_string(),
        ];
        // Create a temporary file with a valid private key
        let private_key = b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356";
        let key_path = "/tmp/key";

        create_priv_key(key_path, private_key).await;

        let cfg = get_test_config_with_single_provider_multiple_fallbacks(
            network,
            key_path,
            urls.clone(),
        );

        // test
        let binding: Arc<RwLock<HashMap<String, Arc<Mutex<RpcProvider>>>>> =
            init_shared_rpc_providers(&cfg, Some("test_iterate_over_fallback_urls")).await;
        {
            let result = binding.read().await;
            assert_eq!(result.len(), 1);
        }

        let provider = binding.write().await;
        let provider = provider.get(network).unwrap();
        let mut provider = provider.lock().await;
        assert_eq!(provider.providers.len(), urls.len());

        for i in 0..urls.len() * 2 {
            assert_eq!(provider.active_provider_index as usize, i % urls.len());
            provider.switch_provider();
        }
    }
}
