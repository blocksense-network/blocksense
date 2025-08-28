use anyhow::Result;
use futures::{stream::FuturesUnordered, StreamExt};

use std::collections::HashMap;

use crate::{
    domain::{
        group_feeds_by_marketplace, map_assets_to_feeds, FeedConfig, Marketplace, RatesPerFeed,
        RatesPerFeedPerMarket,
    },
    providers::{
        euler::fetch_borrow_rates_from_euler,
        hyperdrive::fetch_borrow_rates_from_hyperdrive,
        hyperlend::{
            HyperLendUi, HYPERLAND_POOL_ADDRESSES_PROVIDER, HYPERLAND_UI_POOL_DATA_PROVIDER,
        },
        hypurrfi::{HypurrFiUi, HYPURRFI_POOL_ADDRESSES_PROVIDER, HYPURRFI_UI_POOL_DATA_PROVIDER},
        onchain::{fetch_reserves, plan_for},
    },
    utils::logging::print_marketplace_data,
};
use tracing::warn;

async fn fetch_market<'a>(
    which: Marketplace,
    feeds_config: Option<&'a [FeedConfig]>,
) -> Result<(Marketplace, Result<RatesPerFeed>)> {
    match which {
        Marketplace::HypurrFi => {
            let rates_info = fetch_reserves(plan_for::<HypurrFiUi>(
                HYPURRFI_UI_POOL_DATA_PROVIDER,
                HYPURRFI_POOL_ADDRESSES_PROVIDER,
            )?)
            .await?;
            Ok((
                Marketplace::HypurrFi,
                Ok(map_assets_to_feeds(rates_info, feeds_config.unwrap_or(&[]))),
            ))
        }
        Marketplace::HyperLend => {
            let rates_info = fetch_reserves(plan_for::<HyperLendUi>(
                HYPERLAND_UI_POOL_DATA_PROVIDER,
                HYPERLAND_POOL_ADDRESSES_PROVIDER,
            )?)
            .await?;
            Ok((
                Marketplace::HyperLend,
                Ok(map_assets_to_feeds(
                    rates_info,
                    feeds_config.unwrap_or(&Vec::new()),
                )),
            ))
        }
        Marketplace::HyperDrive => Ok((
            Marketplace::HyperDrive,
            fetch_borrow_rates_from_hyperdrive(feeds_config).await,
        )),

        Marketplace::EulerFinance => Ok((
            Marketplace::EulerFinance,
            fetch_borrow_rates_from_euler(feeds_config).await,
        )),
    }
}

pub async fn collect_borrow_rates(feeds_config: &Vec<FeedConfig>) -> Result<RatesPerFeed> {
    let mut borrow_rates_per_marketplace: RatesPerFeedPerMarket = HashMap::new();

    let grouped_feeds = group_feeds_by_marketplace(feeds_config);

    let mut futures: FuturesUnordered<_> = [
        Marketplace::HypurrFi,
        Marketplace::HyperLend,
        Marketplace::HyperDrive,
        Marketplace::EulerFinance,
    ]
    .into_iter()
    .map(|marketplace| {
        fetch_market(
            marketplace,
            grouped_feeds.get(&marketplace).map(|v| v.as_slice()),
        )
    })
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
