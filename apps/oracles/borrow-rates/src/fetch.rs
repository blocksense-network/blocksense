use anyhow::Result;
use futures::{stream::FuturesUnordered, StreamExt};

use std::collections::{HashMap, HashSet};

use crate::{
    domain::{
        group_feeds_by_marketplace_type, map_assets_to_feeds, FeedConfig, Marketplace,
        MarketplaceType, RatesPerFeed, RatesPerFeedPerMarket, SupportedNetworks,
    },
    providers::{
        euler::fetch_borrow_rates_from_euler, hyperdrive::fetch_borrow_rates_from_hyperdrive,
        pool_data_provider::fetch_reserves,
    },
    utils::logging::print_marketplace_data,
};
use tracing::warn;

/// Extracts unique networks from feeds configuration for network-based marketplaces
fn extract_unique_networks_from_feeds(feeds_config: &[FeedConfig]) -> Vec<SupportedNetworks> {
    feeds_config
        .iter()
        .filter_map(|feed| match &feed.arguments {
            Marketplace::Aave(args) => Some(args.network),
            Marketplace::HypurrFi(args) => Some(args.network),
            Marketplace::HyperLend(args) => Some(args.network),
            Marketplace::EulerFinance(args) => Some(args.network),
            Marketplace::HyperDrive(_) => None,
        })
        .collect::<HashSet<_>>()
        .into_iter()
        .collect()
}

async fn fetch_market<'a>(
    marketplace_type: MarketplaceType,
    feeds_config: &'a [FeedConfig],
) -> Result<(MarketplaceType, Result<RatesPerFeed>)> {
    match marketplace_type {
        MarketplaceType::HypurrFi | MarketplaceType::HyperLend | MarketplaceType::Aave => {
            let mut result = (marketplace_type, Ok(RatesPerFeed::new()));

            let networks = extract_unique_networks_from_feeds(feeds_config);
            for network in networks {
                // Create a marketplace instance for the API call - we can use the first feed's marketplace
                let marketplace = feeds_config[0].arguments.clone();
                let rates_info = fetch_reserves(marketplace, network).await?;
                let feeds_results = map_assets_to_feeds(rates_info, feeds_config, Some(network));
                if let Ok(ref mut map) = result.1 {
                    map.extend(feeds_results);
                }
            }
            Ok(result)
        }
        MarketplaceType::HyperDrive => Ok((
            marketplace_type,
            fetch_borrow_rates_from_hyperdrive(feeds_config).await,
        )),
        MarketplaceType::EulerFinance => Ok((
            marketplace_type,
            fetch_borrow_rates_from_euler(Some(&feeds_config)).await,
        )),
    }
}

pub async fn collect_borrow_rates(feeds_config: &Vec<FeedConfig>) -> Result<RatesPerFeed> {
    let mut borrow_rates_per_marketplace: RatesPerFeedPerMarket = HashMap::new();

    let grouped_feeds = group_feeds_by_marketplace_type(feeds_config);

    let mut futures: FuturesUnordered<_> = grouped_feeds
        .iter()
        .map(|(marketplace_type, feeds)| fetch_market(*marketplace_type, feeds.as_slice()))
        .collect();

    while let Some(result) = futures.next().await {
        match result {
            Ok((name, Ok(rates))) => {
                borrow_rates_per_marketplace.insert(name, rates);
            }
            Ok((name, Err(err))) => {
                warn!("{:?} fetch failed: {}", name, err);
            }
            Err(err) => {
                warn!("fetch_market future failed: {}", err);
            }
        }
    }

    print_marketplace_data(&borrow_rates_per_marketplace);

    let borrow_rates_per_feed = borrow_rates_per_marketplace
        .into_values()
        .flatten()
        .collect();

    Ok(borrow_rates_per_feed)
}
