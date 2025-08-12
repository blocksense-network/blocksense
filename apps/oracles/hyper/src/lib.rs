mod domain;
mod fetch;
mod providers;
mod utils;

use std::{str::FromStr, time::Instant};

use anyhow::Result;
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};

use crate::utils::logging::print_payload;

use crate::domain::{get_resources_from_settings, Marketplace};
use crate::fetch::get_borrow_rates_for_marketplace;

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    let feeds_config = get_resources_from_settings(&settings)?;
    let mut payload = Payload::new();
    // Fetch borrow rates for each marketplace and store in a HashMap
    let before_fetch = Instant::now();

    let marketplace_borrow_rates = get_borrow_rates_for_marketplace(&feeds_config).await?;
    let time_taken = before_fetch.elapsed();
    println!(
        "Fetched borrow rates for {} feeds in {:?}",
        feeds_config.len(),
        time_taken
    );

    for feed in &feeds_config {
        let rate_info = match Marketplace::from_str(feed.arguments.marketplace.as_str()) {
            Ok(market_enum) => marketplace_borrow_rates
                .get(&market_enum)
                .and_then(|rates| rates.get(&feed.pair.base)),
            Err(_) => None,
        };

        let value = match rate_info {
            Some(info) => DataFeedResultValue::Numerical(info.borrow_rate),
            None => DataFeedResultValue::Error(format!(
                "No data for {} in {}",
                feed.pair.base, feed.arguments.marketplace
            )),
        };

        payload.values.push(DataFeedResult {
            id: feed.feed_id.to_string(),
            value,
        });
    }

    print_payload(&payload, &feeds_config);
    Ok(payload)
}
