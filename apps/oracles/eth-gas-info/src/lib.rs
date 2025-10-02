mod domain;
mod fetch;
mod utils;

use anyhow::Result;
use tracing::{info, warn};

use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};

use crate::domain::get_feed_configs_from_settings;
use crate::fetch::{fetch_gas_oracle_data, GasOraclePayload};
use crate::utils::logging::print_gas_oracle_results;

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    tracing_subscriber::fmt::init();
    info!("Starting oracle component - eth-gas-info");

    // Parse feed configurations
    let feed_configs = get_feed_configs_from_settings(&settings)?;
    let feed_ids: Vec<String> = settings
        .data_feeds
        .iter()
        .map(|feed| feed.id.clone())
        .collect();

    // Fetch gas oracle data
    let mut payload = Payload::new();

    let gas_result = fetch_gas_oracle_data().await;

    process_feeds(&mut payload, &feed_configs, &feed_ids, &gas_result);

    match &gas_result {
        Ok(gas_data) => {
            print_gas_oracle_results(&feed_configs, gas_data, &feed_ids);
        }
        Err(_) => {
            // Error already logged in fetch function
        }
    }

    Ok(payload)
}

/// Process feeds for both success and error cases
fn process_feeds(
    payload: &mut Payload,
    feed_configs: &[domain::FeedConfig],
    feed_ids: &[String],
    gas_result: &Result<GasOraclePayload>,
) {
    for (feed_id, config) in feed_ids.iter().zip(feed_configs.iter()) {
        let value = match gas_result {
            Ok(gas_data) => {
                let metric_value = gas_data.get_value_by_base(&config.pair.base);

                if !matches!(config.pair.base.as_str(), "SafeGasPrice" | "ProposeGasPrice" | "FastGasPrice" | "suggestBaseFee") {
                    warn!("Unknown pair.base '{}', defaulting to ProposeGasPrice", config.pair.base);
                }

                DataFeedResultValue::Numerical(metric_value)
            }
            Err(error) => DataFeedResultValue::Error(error.to_string()),
        };

        payload.values.push(DataFeedResult {
            id: feed_id.clone(),
            value,
        });
    }
}
