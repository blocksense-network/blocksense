use alloy::providers::Provider;
use alloy::transports::http::Http;
use alloy::{
    hex,
    network::{Ethereum, EthereumWallet},
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
use reqwest::{Client, Url};

use config::SequencerConfig;
use prometheus::metrics::ProviderMetrics;
use std::collections::HashMap;
use std::fs;
use std::sync::Arc;
use tokio::spawn;
use tokio::sync::{Mutex, RwLock};
use tokio::time::Duration;
use tracing::{debug, error, info, warn};

pub type ProviderType = FillProvider<
    JoinFill<
        JoinFill<
            Identity,
            JoinFill<GasFiller, JoinFill<BlobGasFiller, JoinFill<NonceFiller, ChainIdFiller>>>,
        >,
        WalletFiller<EthereumWallet>,
    >,
    RootProvider<Http<Client>>,
    Http<Client>,
    Ethereum,
>;

pub fn parse_eth_address(addr: &str) -> Option<Address> {
    let contract_address: Option<Address> = addr.parse().ok();
    contract_address
}

#[derive(Debug)]
pub struct RpcProvider {
    pub provider: ProviderType,
    pub signer: PrivateKeySigner,
    pub contract_address: Option<Address>,
    pub event_contract_address: Option<Address>,
    pub provider_metrics: Arc<RwLock<ProviderMetrics>>,
    pub transaction_timeout_secs: u32,
    pub transaction_gas_limit: u32,
    pub data_feed_store_byte_code: Option<Vec<u8>>,
    pub data_feed_sports_byte_code: Option<Vec<u8>>,
    pub impersonated_anvil_account: Option<Address>,
}

pub type SharedRpcProviders = Arc<RwLock<HashMap<String, Arc<Mutex<RpcProvider>>>>>;

pub async fn can_read_contract_bytecode(provider: Arc<Mutex<RpcProvider>>, addr: &Address) -> bool {
    let bytecode = match provider.lock().await.provider.get_code_at(*addr).await {
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
        if let Some(addr) = parse_eth_address(addr_str.as_str()) {
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
    let mut providers: HashMap<String, Arc<Mutex<RpcProvider>>> = HashMap::new();

    let provider_metrics = Arc::new(RwLock::new(
        ProviderMetrics::new(prefix).expect("Failed to allocate ProviderMetrics"),
    ));

    for (key, p) in &conf.providers {
        let rpc_url: Url = p
            .url
            .parse()
            .unwrap_or_else(|_| panic!("Not a valid url provided for {key}!"));
        let priv_key_path = &p.private_key_path;
        let priv_key = fs::read_to_string(priv_key_path.clone()).unwrap_or_else(|_| {
            panic!(
                "Failed to read private key for {} from {}",
                key, priv_key_path
            )
        });
        let signer: PrivateKeySigner = priv_key
            .trim()
            .parse()
            .unwrap_or_else(|_| panic!("Incorrect private key specified {}.", priv_key));
        let provider = ProviderBuilder::new()
            .with_recommended_fillers()
            .wallet(EthereumWallet::from(signer.clone()))
            .on_http(rpc_url);
        let address = match &p.contract_address {
            Some(x) => parse_eth_address(x.as_str()),
            None => None,
        };
        let event_address = match &p.event_contract_address {
            Some(x) => parse_eth_address(x.as_str()),
            None => None,
        };
        let impersonated_anvil_account = match &p.impersonated_anvil_account {
            Some(x) => parse_eth_address(x.as_str()),
            None => None,
        };

        let rpc_provider = Arc::new(Mutex::new(RpcProvider {
            contract_address: address,
            event_contract_address: event_address,
            provider,
            signer,
            provider_metrics: provider_metrics.clone(),
            transaction_timeout_secs: p.transaction_timeout_secs,
            transaction_gas_limit: p.transaction_gas_limit,
            data_feed_store_byte_code: p.data_feed_store_byte_code.clone().map(|byte_code| {
                hex::decode(byte_code.clone())
                    .expect("data_feed_store_byte_code for provider is not valid hex string!")
            }),
            data_feed_sports_byte_code: p.data_feed_sports_byte_code.clone().map(|byte_code| {
                hex::decode(byte_code.clone())
                    .expect("data_feed_sports_byte_code for provider is not valid hex string!")
            }),
            impersonated_anvil_account,
        }));

        providers.insert(key.clone(), rpc_provider.clone());

        // Verify contract_address
        // If contract does not exist statements are logged and the process continues
        verify_contract_exists(key, &p.contract_address, rpc_provider.clone()).await;

        // Verify event_contract_address
        // If contract does not exist statements are logged and the process continues
        verify_contract_exists(key, &p.event_contract_address, rpc_provider.clone()).await;
    }

    debug!("List of providers:");
    for (key, value) in &providers {
        debug!("{}: {:?}", key, value);
    }

    providers
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
    use eyre::Result;
    use utils::test_env::get_test_private_key_path;

    use crate::providers::provider::get_rpc_providers;
    use alloy::consensus::Transaction;
    use alloy::providers::Provider as AlloyProvider;
    use config::get_test_config_with_single_provider;

    #[tokio::test]
    async fn basic_test_provider() -> Result<()> {
        let network = "ETH";

        let anvil = Anvil::new().try_spawn()?;
        let key_path = get_test_private_key_path();

        let cfg =
            get_test_config_with_single_provider(network, key_path.as_path(), &anvil.endpoint());

        let providers = get_rpc_providers(&cfg, "basic_test_provider_").await;
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
        let providers = get_rpc_providers(&cfg, "test_get_wallet_success_").await;

        // Call the function
        let wallet = &providers[network].lock().await.signer;

        // Check if the wallet's address matches the expected address
        assert_eq!(wallet.address().to_string(), expected_wallet_address);
    }

    // Copied from the alloy source code as an example.
    #[tokio::test]
    async fn no_gas_price_or_limit() {
        let provider = ProviderBuilder::new()
            .with_recommended_fillers()
            .on_anvil_with_wallet();

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
}
