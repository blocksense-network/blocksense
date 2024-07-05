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
use envload::Envload;
use envload::LoadEnv;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::info;

pub type ProviderType = FillProvider<
    JoinFill<
        JoinFill<JoinFill<JoinFill<Identity, GasFiller>, NonceFiller>, ChainIdFiller>,
        SignerFiller<EthereumSigner>,
    >,
    RootProvider<Http<Client>>,
    Http<Client>,
    Ethereum,
>;

#[derive(Envload)]
pub struct SequencerConfig {
    rpc_url: Url,
    private_key: String,
    contract_address: Option<String>,
}

pub fn get_wallet() -> LocalWallet {
    let env = <SequencerConfig as LoadEnv>::load_env();
    let priv_key = fs::read_to_string(env.private_key.clone())
        .expect(format!("Failed to read private key from {}", env.private_key).as_str());

    let wallet: LocalWallet = priv_key
        .trim()
        .parse()
        .expect("Incorrect private key specified.");
    wallet
}

pub fn get_contract_address() -> Address {
    let env = <SequencerConfig as LoadEnv>::load_env();
    let contract_address: Address = env
        .contract_address
        .expect("Contract address not provided in environment.")
        .parse()
        .expect("Contract address not found.");
    contract_address
}

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
}

pub type SharedRpcProviders = Arc<std::sync::RwLock<HashMap<String, Arc<Mutex<RpcProvider>>>>>;

pub fn init_shared_rpc_providers() -> SharedRpcProviders {
    Arc::new(std::sync::RwLock::new(get_rpc_providers()))
}

fn get_rpc_providers() -> HashMap<String, Arc<Mutex<RpcProvider>>> {
    let mut providers: HashMap<String, Arc<Mutex<RpcProvider>>> = HashMap::new();
    let mut urls: HashMap<String, String> = HashMap::new();
    let mut keys: HashMap<String, String> = HashMap::new();
    let mut contract_addresses: HashMap<String, String> = HashMap::new();

    for (key, value) in env::vars() {
        if let Some(name) = key.strip_prefix("WEB3_URL_") {
            urls.insert(name.to_string(), value);
        } else if let Some(name) = key.strip_prefix("WEB3_PRIVATE_KEY_") {
            keys.insert(name.to_string(), value);
        } else if let Some(name) = key.strip_prefix("WEB3_CONTRACT_ADDRESS_") {
            contract_addresses.insert(name.to_string(), value);
        }
    }

    for (key, value) in &urls {
        let rpc_url: Url = value
            .parse()
            .expect(format!("Not a valid url provided for {key}!").as_str());
        let priv_key = keys
            .get(key)
            .expect(format!("No key provided for {key}!").as_str());
        let priv_key = fs::read_to_string(priv_key)
            .expect(format!("Failed to read private key for {} from {}", key, priv_key).as_str());
        let wallet: LocalWallet = priv_key
            .trim()
            .parse()
            .expect("Incorrect private key specified.");
        let provider = ProviderBuilder::new()
            .with_recommended_fillers()
            .signer(EthereumSigner::from(wallet.clone()))
            .on_http(rpc_url);
        let address = match contract_addresses.get(key) {
            Some(x) => parse_contract_address(x),
            None => None,
        };
        providers.insert(
            key.to_string(),
            Arc::new(Mutex::new(RpcProvider {
                contract_address: address,
                provider,
                wallet,
                provider_metrics: ProviderMetrics::new(key),
            })),
        );
    }

    info!("List of providers:");
    for (key, value) in &providers {
        info!("{}: {:?}", key, value);
    }

    providers
}

// pub fn print_type<T>(_: &T) {
//     println!("{:?}", std::any::type_name::<T>());
// }

// fn get_provider() -> RootProvider<Http<Client>> {
//     let rpc_url = get_rpc_url();

//     // Create the RPC client.
//     let rpc_client = RpcClient::new_http(rpc_url);

//     // Provider can then be instantiated using the RPC client, ReqwestProvider is an alias
//     // RootProvider. RootProvider requires two generics N: Network and T: Transport
//     let provider = ReqwestProvider::<Ethereum>::new(rpc_client);
//     provider
// }

// pub fn init_shared_provider() -> Arc<Mutex<ProviderType>> {
//     Arc::new(Mutex::new(get_provider()))
// }

pub fn get_provider() -> ProviderType {
    // Create a provider with a signer.

    let env = <SequencerConfig as LoadEnv>::load_env();

    let wallet = get_wallet();

    // Set up the HTTP provider with the `reqwest` crate.
    let provider = ProviderBuilder::new()
        .with_recommended_fillers()
        .signer(EthereumSigner::from(wallet))
        .on_http(env.rpc_url);

    provider
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::write;
    use std::{fs::File, io::Write};

    use alloy::{
        network::TransactionBuilder, node_bindings::Anvil, primitives::U256, providers::Provider,
        rpc::types::eth::request::TransactionRequest,
    };
    use eyre::Result;
    use std::env;

    use crate::providers::provider::get_provider;

    #[tokio::test]
    async fn basic_test_provider() -> Result<()> {
        env::set_var("PRIVATE_KEY", "/tmp/key");
        let configured_contract_address = "0xef11D1c2aA48826D4c41e54ab82D1Ff5Ad8A64Ca";
        env::set_var("CONTRACT_ADDRESS", configured_contract_address);
        let mut file = File::create("/tmp/key")?;
        file.write(b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356")?;

        let anvil = Anvil::new().try_spawn()?;
        env::set_var("RPC_URL", anvil.endpoint());
        let provider = get_provider();

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
    fn test_get_rpc_providers() {
        // setup
        env::set_var("WEB3_URL_ETH1", "http://127.0.0.1:8545");
        env::set_var(
            "WEB3_CONTRACT_ADDRESS_ETH1",
            "0xef11d1c2aa48826d4c41e54ab82d1ff5ad8a64ca",
        );
        env::set_var("WEB3_PRIVATE_KEY_ETH1", "/tmp/priv_key_test");
        let mut file = File::create("/tmp/priv_key_test").unwrap();
        file.write(b"0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356")
            .unwrap();

        // test
        let binding = init_shared_rpc_providers();
        let result = binding.read().unwrap();

        // assert
        assert_eq!(result.len(), 1);
    }
}
