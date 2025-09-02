mod domain;
mod fetch_prices;
mod logging;

use anyhow::Result;

use blocksense_data_providers_sdk::price_data::{types::PairsToResults, wap::vwap::compute_vwap};
use tracing::info;

use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};

use crate::{
    domain::{get_capabilities_from_settings, get_resources_from_settings},
    fetch_prices::get_prices,
    logging::print_results,
};

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    tracing_subscriber::fmt::init();

    info!("Starting oracle component - Forex Price Feeds");

    let resources = get_resources_from_settings(&settings)?;
    let capabilities = get_capabilities_from_settings(&settings);
    let timeout_secs = settings.interval_time_in_seconds - 1;

    let results = get_prices(&resources, &capabilities, timeout_secs).await?;
    let payload = process_results(&results)?;

    print_results(&resources.pairs, &results, &payload);
    Ok(payload)
}

fn process_results(results: &PairsToResults) -> Result<Payload> {
    let mut payload = Payload::new();
    for (feed_id, results) in results.iter() {
        let price_points = results.providers_data.values();

        payload.values.push(match compute_vwap(price_points) {
            Ok(price) => DataFeedResult {
                id: feed_id.to_string(),
                value: DataFeedResultValue::Numerical(price),
            },
            Err(err) => DataFeedResult {
                id: feed_id.to_string(),
                value: DataFeedResultValue::Error(err.to_string()),
            },
        });
    }

    Ok(payload)
}
