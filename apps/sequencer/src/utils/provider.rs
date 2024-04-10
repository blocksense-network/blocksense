use alloy::transports::http::Http;
use alloy::{
    network::{Ethereum, EthereumSigner},
    primitives::Address,
    providers::{
        layers::{ManagedNonceProvider, NonceManagerLayer, SignerProvider},
        ProviderBuilder, RootProvider,
    },
    signers::wallet::LocalWallet,
};
use reqwest::{Client, Url};

use envload::Envload;
use envload::LoadEnv;

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

pub fn get_provider() -> ManagedNonceProvider<
    Http<Client>,
    SignerProvider<Http<Client>, RootProvider<Http<Client>, Ethereum>, EthereumSigner, Ethereum>,
    Ethereum,
> {
    // Create a provider with a signer.

    let env = <SequencerConfig as LoadEnv>::load_env();

    let wallet = get_wallet();

    // Set up the HTTP provider with the `reqwest` crate.
    let provider = ProviderBuilder::new()
        .layer(NonceManagerLayer)
        .signer(EthereumSigner::from(wallet))
        .on_reqwest_http(env.rpc_url)
        .unwrap();
    provider
}
