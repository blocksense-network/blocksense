use std::{collections::HashMap, str::FromStr, sync::Arc};
use url::Url;

use alloy::primitives::{Address, B256};
use alloy::sol_types::SolCall;
use anyhow::Result;
use futures::{stream::FuturesUnordered, StreamExt};
use tracing::warn;

use crate::domain::{BorrowRateInfo, FeedConfig, Marketplace, RatesPerFeed, SupportedNetworks};
use crate::providers::types::{MyProvider, RPC_URL_ETHEREUM_MAINNET};
use crate::utils::math::apr_from_per_sec_wad;
use blocksense_sdk::eth_rpc::eth_call;

// Generate bindings for MorphoCore ABI
alloy::sol! {
    #[allow(missing_docs)]
    #[allow(clippy::too_many_arguments)]
    #[sol(rpc)]
    MorphoCore,
    "src/abi/Morpho/MorphoCore.json"
}

// Generate bindings for IRM ABI
alloy::sol! {
    #[allow(missing_docs)]
    #[allow(clippy::too_many_arguments)]
    #[sol(rpc)]
    Irm,
    "src/abi/Morpho/IRM.json"
}

async fn fetch_borrow_rate(
    provider: &MyProvider,
    morpho_core_address: Address,
    market_id: B256,
    rpc_url: &str,
) -> Result<f64> {
    // Create instance and call
    let morpho_core = MorphoCore::new(morpho_core_address, &provider);
    let market_params_call = morpho_core.idToMarketParams(market_id);
    let market_params_calldata = market_params_call.calldata();

    // Call idToMarketParams on Morpho Core
    let market_params_raw = eth_call(
        rpc_url,
        &format!("{:?}", morpho_core_address),
        market_params_calldata,
    )
    .await
    .map_err(|e| anyhow::Error::msg(format!("{:?}", e)))?;

    let market_params_result =
        MorphoCore::idToMarketParamsCall::abi_decode_returns(&market_params_raw)?;

    // Create call to market
    let market_call = morpho_core.market(market_id);
    let market_calldata = market_call.calldata();

    // Call market on Morpho Core
    let market_raw = eth_call(
        rpc_url,
        &format!("{:?}", morpho_core_address),
        market_calldata,
    )
    .await
    .map_err(|e| anyhow::Error::msg(format!("{:?}", e)))?;

    let market_state_result = MorphoCore::marketCall::abi_decode_returns(&market_raw)?;

    // Create MarketParams struct for IRM call
    let market_params_for_irm = Irm::MarketParams {
        loanToken: market_params_result.loanToken,
        collateralToken: market_params_result.collateralToken,
        oracle: market_params_result.oracle,
        irm: market_params_result.irm,
        lltv: market_params_result.lltv,
    };

    // Create Market struct for IRM call
    let market_state_for_irm = Irm::Market {
        totalSupplyAssets: market_state_result.totalSupplyAssets,
        totalSupplyShares: market_state_result.totalSupplyShares,
        totalBorrowAssets: market_state_result.totalBorrowAssets,
        totalBorrowShares: market_state_result.totalBorrowShares,
        lastUpdate: market_state_result.lastUpdate,
        fee: market_state_result.fee,
    };

    // Create call to borrowRateView on IRM contract
    let irm = Irm::new(market_params_result.irm, &provider);
    let irm_call = irm.borrowRateView(market_params_for_irm, market_state_for_irm);
    let irm_calldata = irm_call.calldata();

    // Call borrowRateView on IRM contract
    let irm_raw = eth_call(
        rpc_url,
        &format!("{:?}", market_params_result.irm),
        irm_calldata,
    )
    .await
    .map_err(|e| anyhow::Error::msg(format!("{:?}", e)))?;

    let per_sec_wad = Irm::borrowRateViewCall::abi_decode_returns(&irm_raw)?;

    let apr = apr_from_per_sec_wad(per_sec_wad);
    Ok(apr)
}

pub async fn fetch_borrow_rates_from_morpho(
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
                .map_or(&[], std::ops::Deref::deref),
        )
        .await?,
    );
    Ok(borrow_rates)
}

/// Fetch borrow rates for Morpho on Ethereum Mainnet
async fn fetch_borrow_rates_on_ethereum_mainnet(feeds: &[FeedConfig]) -> Result<RatesPerFeed> {
    let rpc_url = RPC_URL_ETHEREUM_MAINNET;

    fetch_borrow_rates_for_network(feeds, rpc_url).await
}

/// Generic function to fetch borrow rates for any network
async fn fetch_borrow_rates_for_network(
    feeds: &[FeedConfig],
    rpc_url: &str,
) -> Result<RatesPerFeed> {
    let mut borrow_rates: RatesPerFeed = RatesPerFeed::new();
    let mut futures = FuturesUnordered::new();

    // Create provider similar to Euler
    let url = Url::parse(rpc_url)?;
    let provider = Arc::new(alloy::providers::ProviderBuilder::new().connect_http(url));

    for feed in feeds {
        let (market_id_bytes, morpho_core_address) = match &feed.arguments {
            Marketplace::Morpho(args) => (args.market_id, args.morpho_core_address),
            _ => continue,
        };

        // Convert [u8; 32] to B256
        let market_id_b256 = B256::from(market_id_bytes);

        let feed_id = feed.feed_id.clone();
        let asset = feed.pair.base.clone();
        let rpc_url = rpc_url.to_string();
        let provider = provider.clone();

        let fut = async move {
            let result =
                fetch_borrow_rate(&provider, morpho_core_address, market_id_b256, &rpc_url).await;
            (feed_id, asset, result)
        };

        futures.push(fut);
    }

    while let Some((feed_id, asset, result)) = futures.next().await {
        match result {
            Ok(rate) => {
                borrow_rates.insert(
                    feed_id,
                    BorrowRateInfo {
                        asset,
                        underlying_asset: None,
                        borrow_rate: rate,
                    },
                );
            }
            Err(err) => {
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
            Marketplace::Morpho(args) => args.network,
            _ => continue,
        };

        grouped.entry(network).or_default().push(feed.clone());
    }

    grouped
}
