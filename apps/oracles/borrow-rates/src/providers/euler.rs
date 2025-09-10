use std::{collections::HashMap, sync::Arc};

use alloy::primitives::{Address, U256};
use alloy::providers::ProviderBuilder;
use alloy::sol_types::SolCall;
use anyhow::Result;
use futures::{stream::FuturesUnordered, StreamExt};
use tracing::warn;
use url::Url;

use crate::domain::{BorrowRateInfo, FeedConfig, Marketplace, RatesPerFeed, SupportedNetworks};
use crate::providers::types::{MyProvider, RPC_URL_ETHEREUM_MAINNET};
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
        RPC_URL_ETHEREUM_MAINNET,
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

    let rpc_url = Url::parse(RPC_URL_ETHEREUM_MAINNET)?;
    let provider = Arc::new(ProviderBuilder::new().connect_http(rpc_url.clone()));

    let mut futures = FuturesUnordered::new();

    for feed in feeds {
        let (utils_lens_address, vault_address) = match &feed.arguments {
            Marketplace::EulerFinance(args) => (args.utils_lens_address, args.vault_address),
            _ => continue,
        };

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
                warn!("Error fetching borrow rate for feed {}: {}", feed_id, err);
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
        let network = match &feed.arguments {
            Marketplace::EulerFinance(args) => args.network,
            _ => continue,
        };

        grouped.entry(network).or_default().push(feed.clone());
    }

    grouped
}
