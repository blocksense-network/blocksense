use alloy::providers::Provider;
use alloy::transports::http::Http;
use alloy::{
    network::{Ethereum, EthereumSigner},
    primitives::Address,
    providers::{
        fillers::{ChainIdFiller, FillProvider, GasFiller, JoinFill, NonceFiller, SignerFiller},
        Identity, ProviderBuilder, RootProvider,
    },
    signers::wallet::LocalWallet,
};
use reqwest::{Client, Url};

use super::provider_metrics::ProviderMetrics;
use sequencer_config::SequencerConfig;
use std::collections::HashMap;
use std::fs;
use std::sync::Arc;
use tokio::spawn;
use tokio::sync::Mutex;
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
    pub provider: ProviderType,
    pub wallet: LocalWallet,
    pub contract_address: Option<Address>,
    pub provider_metrics: ProviderMetrics,
    pub transcation_timeout_secs: u32,
}

pub type SharedRpcProviders = Arc<std::sync::RwLock<HashMap<String, Arc<Mutex<RpcProvider>>>>>;

async fn chech_if_contract_exists(provider: Arc<Mutex<RpcProvider>>, addr: &Address) -> bool {
    let latest_block = provider
        .lock()
        .await
        .provider
        .get_block_number()
        .await
        .expect("Could not lock provider mutex!");
    let bytecode = provider
        .lock()
        .await
        .provider
        .get_code_at(*addr, latest_block.into())
        .await
        .expect("Could not get bytecode of contract from provider!");
    bytecode.to_string() != "0x"
}

pub async fn init_shared_rpc_providers(conf: &SequencerConfig) -> SharedRpcProviders {
    Arc::new(std::sync::RwLock::new(get_rpc_providers(conf).await))
}

async fn get_rpc_providers(conf: &SequencerConfig) -> HashMap<String, Arc<Mutex<RpcProvider>>> {
    let mut providers: HashMap<String, Arc<Mutex<RpcProvider>>> = HashMap::new();

    for (key, p) in &conf.providers {
        let rpc_url: Url = p
            .url
            .parse()
            .expect(format!("Not a valid url provided for {key}!").as_str());
        let priv_key_path = &p.private_key_path;
        let priv_key = fs::read_to_string(priv_key_path.clone()).expect(
            format!(
                "Failed to read private key for {} from {}",
                key, priv_key_path
            )
            .as_str(),
        );
        let wallet: LocalWallet = priv_key
            .trim()
            .parse()
            .expect("Incorrect private key specified.");
        let provider = ProviderBuilder::new()
            .with_recommended_fillers()
            .signer(EthereumSigner::from(wallet.clone()))
            .on_http(rpc_url);
        let address = match &p.contract_address {
            Some(x) => parse_contract_address(x.as_str()),
            None => None,
        };

        let rpc_provider = Arc::new(Mutex::new(RpcProvider {
            contract_address: address,
            provider,
            wallet,
            provider_metrics: ProviderMetrics::new(&key)
                .expect("Failed to allocate ProviderMetrics"),
            transcation_timeout_secs: p.transcation_timeout_secs,
        }));

        providers.insert(key.clone(), rpc_provider.clone());

        match &p.contract_address {
            Some(x) => {
                match parse_contract_address(x.as_str()) {
                    Some(addr) => {
                        info!("Contract address for network {} set to {}. Checking if contract exists ...", key, addr);
                        match spawn(async move {
                            let result = actix_web::rt::time::timeout(
                                Duration::from_secs(5),
                                chech_if_contract_exists(rpc_provider, &addr),
                            )
                            .await;
                            result
                        })
                        .await
                        {
                            Ok(result) => match result {
                                Ok(exists) => {
                                    if exists {
                                        info!(
                                            "Contract for network {} exists on address {}",
                                            key, addr
                                        );
                                    } else {
                                        warn!(
                                            "No contract for network {} exists on address {}",
                                            key, addr
                                        )
                                    }
                                }
                                Err(e) => {
                                    warn!("JSON rpc request to verify contract existence timed out: {}", e);
                                }
                            },
                            Err(e) => {
                                error!("Task join error: {}", e)
                            }
                        };
                    }
                    None => {
                        error!(
                            "Set contract address for network {} is not a valid Ethereum contract address!",
                            key
                        );
                    }
                }
            }
            None => {
                warn!("No contract address set for network {}", key);
            }
        };
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
    use std::fs::write;
    use std::{fs::File, io::Write};

    use alloy::{
        network::TransactionBuilder, node_bindings::Anvil, primitives::U256,
        rpc::types::eth::request::TransactionRequest,
    };
    use eyre::Result;

    use crate::providers::provider::get_rpc_providers;
    use alloy::providers::Provider as AlloyProvider;
    use sequencer_config::Provider;
    use sequencer_config::SequencerConfig;
    use std::collections::HashMap;

    #[tokio::test]
    async fn basic_test_provider() -> Result<()> {
        let private_key_path = "/tmp/key".to_string();
        let network = "ETH".to_string();

        let mut file = File::create("/tmp/key")?;
        file.write(b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356")?;

        let anvil = Anvil::new().try_spawn()?;

        let cfg = SequencerConfig {
            max_keys_to_batch: 1,
            keys_batch_duration: 500,
            providers: HashMap::from([(
                network.clone(),
                Provider {
                    private_key_path,
                    url: anvil.endpoint(),
                    contract_address: None,
                    transcation_timeout_secs: 50,
                },
            )]),
            feeds: Vec::new(),
        };

        let providers = get_rpc_providers(&cfg);
        let provider = &providers.get(&network).unwrap().lock().await.provider;

        let alice = anvil.addresses()[7];
        let bob = anvil.addresses()[0];

        let tx = TransactionRequest::default()
            .with_from(alice)
            .with_to(bob.into())
            .with_value(U256::from(100))
            // Notice that without the `GasEstimatorLayer`, you need to set the gas related fields.
            .with_gas_limit(21000 as u128)
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

        assert_eq!(
            get_contract_address().to_string(),
            configured_contract_address
        );

        // Send the transaction, the nonce (1) is automatically managed by the provider.
        let _builder = provider.send_transaction(tx).await?;
        Ok(())
    }

    #[test]
    fn test_get_wallet_success() {
        // Create a temporary file with a valid private key
        let private_key = b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356";
        let expected_wallet_address = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"; // generated as hash of private_key

        write("/tmp/key", private_key).expect("Failed to write to temp file");

        // Set the environment variables
        env::set_var("PRIVATE_KEY", "/tmp/key");
        env::set_var("RPC_URL", "http://localhost:8545"); // Dummy URL for testing

        // Call the function
        let wallet = get_wallet();

        // Check if the wallet's address matches the expected address
        assert_eq!(wallet.address().to_string(), expected_wallet_address);
    }

    #[test]
    fn test_get_rpc_providers_returns_single_provider() {
        // setup
        let env_var_url = "WEB3_URL_ETH11";
        let env_var_contract_address = "WEB3_CONTRACT_ADDRESS_ETH11";
        let env_var_private_key = "WEB3_PRIVATE_KEY_ETH11";
        env::set_var(env_var_url, "http://127.0.0.1:8545");
        env::set_var(
            env_var_contract_address,
            "0xef11d1c2aa48826d4c41e54ab82d1ff5ad8a64ca",
        );
        env::set_var(env_var_private_key, "/tmp/priv_key_test");
        let mut file = File::create("/tmp/priv_key_test").unwrap();
        file.write(b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356")
            .unwrap();

        // test
        let binding = init_shared_rpc_providers();
        let result = binding.read().unwrap();

        // cleanup
        env::remove_var(env_var_url);
        env::remove_var(env_var_contract_address);
        env::remove_var(env_var_private_key);

        // assert
        assert_eq!(result.len(), 1);
    }
}
