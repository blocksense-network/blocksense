use anyhow::Result;
use futures::{stream::FuturesUnordered, StreamExt};

use std::collections::HashMap;

use crate::{
    domain::{FeedConfig, Marketplace, MarketplaceBorrowRates, Rates},
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
    feeds_config: &'a Vec<FeedConfig>,
) -> Result<(Marketplace, Result<Rates>)> {
    match which {
        Marketplace::HypurrFi => Ok((
            Marketplace::HypurrFi,
            fetch_reserves(plan_for::<HypurrFiUi>(
                HYPURRFI_UI_POOL_DATA_PROVIDER,
                HYPURRFI_POOL_ADDRESSES_PROVIDER,
            )?)
            .await,
        )),
        Marketplace::HyperLend => Ok((
            Marketplace::HyperLend,
            fetch_reserves(plan_for::<HyperLendUi>(
                HYPERLAND_UI_POOL_DATA_PROVIDER,
                HYPERLAND_POOL_ADDRESSES_PROVIDER,
            )?)
            .await,
        )),
        Marketplace::HyperDrive => Ok((
            Marketplace::HyperDrive,
            fetch_borrow_rates_from_hyperdrive(feeds_config).await,
        )),
    }
}

pub async fn get_borrow_rates_for_marketplace(
    feeds_config: &Vec<FeedConfig>,
) -> Result<MarketplaceBorrowRates> {
    let mut marketplace_borrow_rates: MarketplaceBorrowRates = HashMap::new();

    let mut futs = FuturesUnordered::new();
    // iterate over Marketplace Enum and spawn fetches

    futs.push(fetch_market(Marketplace::HypurrFi, feeds_config));
    futs.push(fetch_market(Marketplace::HyperLend, feeds_config));
    futs.push(fetch_market(Marketplace::HyperDrive, feeds_config));

    while let Some(result) = futs.next().await {
        match result {
            Ok((name, res)) => match res {
                Ok(rates) => {
                    marketplace_borrow_rates.insert(name, rates);
                }
                Err(err) => eprintln!("{:?} fetch failed: {}", name, err),
            },
            Err(err) => eprintln!("fetch_market future failed: {}", err),
        }
    }

    print_marketplace_data(&marketplace_borrow_rates);
    Ok(marketplace_borrow_rates)
}
