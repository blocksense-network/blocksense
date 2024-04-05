use alloy::transports::http::Http;
use alloy::{
    network::{Ethereum, EthereumSigner},
    providers::{
        layers::{ManagedNonceProvider, NonceManagerLayer, SignerProvider},
        ProviderBuilder, RootProvider,
    },
    signers::wallet::LocalWallet,
};
use reqwest::{Client, Url};

use std::env::var;

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
    let rpc_url = get_rpc_url();

    let wallet = get_wallet();

    // Set up the HTTP provider with the `reqwest` crate.
    let provider = ProviderBuilder::new()
        .layer(NonceManagerLayer)
        .signer(EthereumSigner::from(wallet))
        .on_reqwest_http(rpc_url)
        .unwrap();
    provider
}

pub fn get_rpc_url() -> Url {
    var("RPC_URL")
        .expect("$RPC_URL is not set")
        .parse()
        .expect("Non valid JSON rpc url provided.")
}

pub fn get_wallet() -> LocalWallet {
    var("PRIVATE_KEY")
        .expect("$PRIVATE_KEY is not set")
        .parse()
        .expect("Incorrect private key specified.")
}

pub fn print_type<T>(_: &T) {
    println!("{:?}", std::any::type_name::<T>());
}
