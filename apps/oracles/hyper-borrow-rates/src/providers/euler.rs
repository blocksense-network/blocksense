use std::{collections::HashMap, str::FromStr, sync::Arc};

use alloy::primitives::{Address, U256};
use alloy::providers::ProviderBuilder;
use alloy::sol_types::SolCall;
use anyhow::Result;
use futures::{stream::FuturesUnordered, StreamExt};
use url::Url;

use crate::domain::{BorrowRateInfo, FeedConfig, RatesPerFeed};
use crate::providers::onchain::{MyProvider, ETHEREUM_MAINNET_RPC_URL};
use crate::utils::math::apr_continuous;
use blocksense_sdk::eth_rpc::eth_call;

pub mod euler {
    alloy::sol! {
        #[allow(missing_docs)]
        #[allow(clippy::too_many_arguments)]
        #[sol(rpc)]
        EulerUtilsLens,
        "src/abi/Euler/utilsLens.json"
    }
}

async fn fetch_borrow_rate(
    provider: &MyProvider,
    lens_address: Address,
    vault_address: Address,
) -> Result<U256> {
    let instance = euler::EulerUtilsLens::new(lens_address, provider);

    let call = instance.getAPYs(vault_address);
    let calldata = call.calldata();
    let raw = eth_call(
        ETHEREUM_MAINNET_RPC_URL,
        &format!("{:?}", lens_address),
        calldata,
    )
    .await
    .map_err(|e| anyhow::Error::msg(format!("{:?}", e)))?;

    let ret = euler::EulerUtilsLens::getAPYsCall::abi_decode_returns(&raw)?;

    Ok(ret.borrowAPY)
}

pub async fn fetch_borrow_rates_from_euler(
    feeds_config: Option<&[FeedConfig]>,
) -> Result<RatesPerFeed> {
    let mut borrow_rates: RatesPerFeed = RatesPerFeed::new();

    let Some(feeds_config) = feeds_config else {
        return Ok(borrow_rates);
    };

    let feeds_by_network = group_feeds_by_network(feeds_config);

    borrow_rates.extend(
        fetch_borrow_rates_on_ethereum_mainnet(
            feeds_by_network
                .get(&SupportedNetworks::EthereumMainnet)
                .unwrap_or(&Vec::new()),
        )
        .await?,
    );
    Ok(borrow_rates)
}

async fn fetch_borrow_rates_on_ethereum_mainnet(feeds: &[FeedConfig]) -> Result<RatesPerFeed> {
    let mut borrow_rates: RatesPerFeed = RatesPerFeed::new();

    let rpc_url = Url::parse(ETHEREUM_MAINNET_RPC_URL)?;
    let provider = Arc::new(ProviderBuilder::new().connect_http(rpc_url.clone()));

    let mut futures = FuturesUnordered::new();

    for feed in feeds {
        let utils_lens_address = feed.arguments.utils_lens_address.clone().unwrap();
        let vault_address = feed.arguments.vault_address.clone().unwrap();

        let feed_id = feed.feed_id.clone();
        let asset = feed.pair.base.clone();
        let provider = provider.clone();
        let fut = async move {
            let result = fetch_borrow_rate(&provider, utils_lens_address, vault_address).await;
            (feed_id, asset, result)
        };

        futures.push(fut);
    }

    while let Some((feed_id, asset, result)) = futures.next().await {
        match result {
            Result::Ok(rate) => {
                borrow_rates.insert(
                    feed_id,
                    BorrowRateInfo {
                        asset: asset,
                        underlying_asset: None,
                        borrow_rate: apr_continuous(rate),
                    },
                );
            }
            Result::Err(err) => {
                eprintln!("Error fetching borrow rate for feed {}: {}", feed_id, err);
            }
        }
    }

    Ok(borrow_rates)
}

pub fn group_feeds_by_network(
    feeds_config: &[FeedConfig],
) -> HashMap<SupportedNetworks, Vec<FeedConfig>> {
    let mut grouped: HashMap<SupportedNetworks, Vec<FeedConfig>> = HashMap::new();

    for feed in feeds_config {
        // check that addresses are in config
        if feed.arguments.network.is_none()
            || feed.arguments.utils_lens_address.is_none()
            || feed.arguments.vault_address.is_none()
        {
            eprintln!(
                "Feed {} missing network or required addresses. Skipping.",
                feed.feed_id
            );
            continue;
        }

        let network = feed.arguments.network.clone().unwrap();

        match SupportedNetworks::from_str(network.as_str()) {
            Ok(network) => grouped.entry(network).or_default().push(feed.clone()),
            Err(_) => {
                eprintln!("Unknown network: {}", network);
            }
        }
    }

    grouped
}

#[derive(Debug, Eq, PartialEq, Hash, Clone)]
pub enum SupportedNetworks {
    EthereumMainnet,
}

impl FromStr for SupportedNetworks {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s {
            "ethereum-mainnet" => SupportedNetworks::EthereumMainnet,
            _ => anyhow::bail!("Unsupported network: {}", s),
        })
    }
}
