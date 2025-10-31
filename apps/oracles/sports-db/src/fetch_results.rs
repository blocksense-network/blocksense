use anyhow::Result;
use blocksense_data_providers_sdk::sports_data::{
    fetchers::{events::last_team_event::LastTeamEventFetcher, fetch::fetch_all_results},
    traits::sports_fetcher::fetch,
    types::{SportsResultData, SportsResults},
};
use futures::stream::FuturesUnordered;

use crate::FeedConfig;

pub async fn get_results(resources: &Vec<FeedConfig>, timeout_secs: u64) -> Result<SportsResults> {
    let futures_set = FuturesUnordered::from_iter(resources.iter().map(|resource| {
        fetch::<LastTeamEventFetcher>(
            resource.arguments.team_id,
            resource.arguments.sport_type.clone(),
            None,
            timeout_secs,
        )
    }));

    let fetched_results = fetch_all_results(futures_set).await;

    let mut final_results = SportsResults::new();
    for price_data_for_exchange in fetched_results {
        fill_results(&resources, price_data_for_exchange, &mut final_results);
    }
    Ok(final_results)
}

fn fill_results(
    resources: &Vec<FeedConfig>,
    prices_per_exchange: SportsResultData,
    results: &mut SportsResults,
) {
    for resource in resources {
        let res = results.entry(resource.feed_id).or_default();
        res.extend(prices_per_exchange.data.clone());
    }
}
