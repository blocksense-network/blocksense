use crate::domain::SupportedNetworks;
use anyhow::Result;
use url::Url;

pub const RPC_URL_HYPEREVM_MAINNET: &str = "https://rpc.hyperliquid.xyz/evm";
pub const RPC_URL_ETHEREUM_MAINNET: &str = "https://eth.blockrazor.xyz";

pub fn get_rpc_url(network: &SupportedNetworks) -> Result<Url> {
    match network {
        SupportedNetworks::HyperevmMainnet => Url::parse(RPC_URL_HYPEREVM_MAINNET)
            .map_err(|e| anyhow::Error::msg(format!("Invalid HyperevmMainnet RPC URL: {}", e))),
        SupportedNetworks::EthereumMainnet => Url::parse(RPC_URL_ETHEREUM_MAINNET)
            .map_err(|e| anyhow::Error::msg(format!("Invalid EthereumMainnet RPC URL: {}", e))),
    }
}

pub type MyProvider = alloy::providers::fillers::FillProvider<
    alloy::providers::fillers::JoinFill<
        alloy::providers::Identity,
        alloy::providers::fillers::JoinFill<
            alloy::providers::fillers::GasFiller,
            alloy::providers::fillers::JoinFill<
                alloy::providers::fillers::BlobGasFiller,
                alloy::providers::fillers::JoinFill<
                    alloy::providers::fillers::NonceFiller,
                    alloy::providers::fillers::ChainIdFiller,
                >,
            >,
        >,
    >,
    alloy::providers::RootProvider,
>;
