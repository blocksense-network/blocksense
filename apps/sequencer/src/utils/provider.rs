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

use envload::Envload;
use envload::LoadEnv;
use std::sync::Arc;
use tokio::sync::Mutex;

use std::fs;

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

pub fn print_type<T>(_: &T) {
    println!("{:?}", std::any::type_name::<T>());
}

// fn get_provider() -> RootProvider<Http<Client>> {
//     let rpc_url = get_rpc_url();

//     // Create the RPC client.
//     let rpc_client = RpcClient::new_http(rpc_url);

//     // Provider can then be instantiated using the RPC client, ReqwestProvider is an alias
//     // RootProvider. RootProvider requires two generics N: Network and T: Transport
//     let provider = ReqwestProvider::<Ethereum>::new(rpc_client);
//     provider
// }

pub fn get_shared_provider() -> Arc<
    Mutex<
        FillProvider<
            JoinFill<
                JoinFill<JoinFill<JoinFill<Identity, GasFiller>, NonceFiller>, ChainIdFiller>,
                SignerFiller<EthereumSigner>,
            >,
            RootProvider<Http<Client>>,
            Http<Client>,
            Ethereum,
        >,
    >,
> {
    Arc::new(Mutex::new(get_provider()))
}

pub fn get_provider() -> FillProvider<
    JoinFill<
        JoinFill<JoinFill<JoinFill<Identity, GasFiller>, NonceFiller>, ChainIdFiller>,
        SignerFiller<EthereumSigner>,
    >,
    RootProvider<Http<Client>>,
    Http<Client>,
    Ethereum,
> {
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
    use std::{fs::File, io::Write};

    use alloy::{
        network::TransactionBuilder, node_bindings::Anvil, primitives::U256, providers::Provider,
        rpc::types::eth::request::TransactionRequest,
    };
    use eyre::Result;
    use std::env;

    use crate::utils::provider::get_provider;

    #[ignore]
    #[tokio::test]
    async fn basic_test_provider() -> Result<()> {
        env::set_var("PRIVATE_KEY", "/tmp/key");
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

        // Send the transaction, the nonce (1) is automatically managed by the provider.
        let builder = provider.send_transaction(tx).await?;
        Ok(())
    }
}
