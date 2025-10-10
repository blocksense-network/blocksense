mod domain;
mod fetch;
mod utils;

use anyhow::Result;
use tracing::info;

use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};

use crate::domain::get_resources_from_settings;
use crate::fetch::{fetch_gas_oracle_data, GasOraclePayload};
use crate::utils::logging::print_results;

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    tracing_subscriber::fmt::init();
    info!("Starting oracle component - eth-gas-info");

    // Parse feed configurations
    let feeds_config = get_resources_from_settings(&settings)?;

    // Fetch gas oracle data
    let mut payload = Payload::new();

    let gas_result = fetch_gas_oracle_data().await;

    process_feeds(&mut payload, &feeds_config, &gas_result);

    print_results(&feeds_config, &payload);

    Ok(payload)
}

/// Process feeds for both success and error cases
fn process_feeds(
    payload: &mut Payload,
    feed_configs: &[domain::FeedConfig],
    gas_result: &Result<GasOraclePayload>,
) {
    for config in feed_configs.iter() {
        let value = match gas_result {
            Ok(gas_data) => match gas_data.get_value_by_metric(&config.arguments.metric) {
                Ok(metric_value) => DataFeedResultValue::Numerical(metric_value),
                Err(error) => DataFeedResultValue::Error(error.to_string()),
            },
            Err(error) => DataFeedResultValue::Error(error.to_string()),
        };

        payload.values.push(DataFeedResult {
            id: config.id.to_string(),
            value,
        });
    }
}
