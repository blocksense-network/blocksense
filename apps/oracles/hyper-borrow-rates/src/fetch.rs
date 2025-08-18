use anyhow::Result;
use futures::{stream::FuturesUnordered, StreamExt};

use std::collections::HashMap;

use crate::{
    domain::{
        group_feeds_by_marketplace, map_assets_to_feeds, FeedConfig, Marketplace, RatesPerFeed,
        RatesPerFeedPerMarket,
    },
    providers::{
        hyperdrive::fetch_borrow_rates_from_hyperdrive,
        hyperlend::{
            HyperLendUi, HYPERLAND_POOL_ADDRESSES_PROVIDER, HYPERLAND_UI_POOL_DATA_PROVIDER,
        },
        hypurrfi::{HypurrFiUi, HYPURRFI_POOL_ADDRESSES_PROVIDER, HYPURRFI_UI_POOL_DATA_PROVIDER},
        onchain::{fetch_reserves, plan_for},
    },
    utils::logging::print_marketplace_data,
};

async fn fetch_market<'a>(
    which: Marketplace,
    feeds_config: Option<&'a Vec<FeedConfig>>,
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
                Ok(map_assets_to_feeds(
                    rates_info,
                    feeds_config.unwrap_or(&Vec::new()),
                )),
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
        ))
    }
}

pub async fn collect_borrow_rates(feeds_config: &Vec<FeedConfig>) -> Result<RatesPerFeed> {
    let mut borrow_rates_per_marketplace: RatesPerFeedPerMarket = HashMap::new();

    let grouped_feeds = group_feeds_by_marketplace(feeds_config);

    let mut futures = FuturesUnordered::new();

    futures.push(fetch_market(
        Marketplace::HypurrFi,
        grouped_feeds.get(&Marketplace::HypurrFi),
    ));
    futures.push(fetch_market(
        Marketplace::HyperLend,
        grouped_feeds.get(&Marketplace::HyperLend),
    ));
    futures.push(fetch_market(
        Marketplace::HyperDrive,
        grouped_feeds.get(&Marketplace::HyperDrive),
    ));

    while let Some(result) = futures.next().await {
        match result {
            Ok((name, res)) => match res {
                Ok(rates) => {
                    borrow_rates_per_marketplace.insert(name, rates);
                }
                Err(err) => eprintln!("{:?} fetch failed: {}", name, err),
            },
            Err(err) => eprintln!("fetch_market future failed: {}", err),
        }
    }

    print_marketplace_data(&borrow_rates_per_marketplace);

    let borrow_rates_per_feed = borrow_rates_per_marketplace
        .values()
        .map(|rates| rates.clone())
        .flatten()
        .collect::<RatesPerFeed>();

    Ok(borrow_rates_per_feed)
}
