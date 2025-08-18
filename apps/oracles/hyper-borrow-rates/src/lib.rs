mod domain;
mod fetch;
mod providers;
mod utils;

use std::time::Instant;

use anyhow::Result;
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};

use crate::utils::logging::print_payload;

use crate::domain::{get_resources_from_settings, Marketplace};
use crate::fetch::collect_borrow_rates;

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    let feeds_config = get_resources_from_settings(&settings)?;
    let mut payload = Payload::new();

    let before_fetch = Instant::now();

    let borrow_rates_per_feed = collect_borrow_rates(&feeds_config).await?;

    let time_taken = before_fetch.elapsed();
    println!(
        "Fetched borrow rates for {} feeds in {:?}",
        feeds_config.len(),
        time_taken
    );

    for (feed_id, rates) in &borrow_rates_per_feed {
        let value = DataFeedResultValue::Numerical(rates.borrow_rate);
        payload.values.push(DataFeedResult {
            id: feed_id.to_string(),
            value,
        });
    }

    print_payload(&payload, &feeds_config);
    Ok(payload)
}
