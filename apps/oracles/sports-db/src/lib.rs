mod fetch_results;
mod logging;

use anyhow::Result;

use blocksense_data_providers_sdk::sports_data::types::SportsResults;
use serde::{Deserialize, Serialize};
use tracing::info;

use blocksense_sdk::{
    oracle::{DataFeedResult, Payload, Settings},
    oracle_component,
};

use crate::{fetch_results::get_results, logging::print_payload};

pub type FeedId = u128;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FeedArguments {
    pub team_id: u64,
    pub sport_type: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FeedConfig {
    #[serde(default, rename = "id")]
    pub feed_id: FeedId,
    pub arguments: FeedArguments,
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    tracing_subscriber::fmt::init();

    info!("Starting oracle component");

    let timeout_secs = settings.interval_time_in_seconds - 1;
    let resources = get_resources_from_settings(&settings)?;

    let results = get_results(&resources, timeout_secs).await?;
    let payload = process_results(results)?;

    print_payload(&payload, &resources);

    Ok(payload)
}

fn process_results(results: SportsResults) -> Result<Payload> {
    let mut payload = Payload::new();
    for (feed_id, data) in results {
        let data_feed_result = DataFeedResult {
            id: feed_id.to_string(),
            value: blocksense_sdk::oracle::DataFeedResultValue::Bytes(data),
        };

        payload.values.push(data_feed_result);
    }

    Ok(payload)
}

pub fn get_resources_from_settings(settings: &Settings) -> Result<Vec<FeedConfig>> {
    let mut config: Vec<FeedConfig> = Vec::new();
    for feed_setting in &settings.data_feeds {
        match serde_json::from_str::<FeedConfig>(&feed_setting.data) {
            Ok(mut feed_config) => {
                feed_config.feed_id = feed_setting.id.parse::<FeedId>()?;
                config.push(feed_config);
            }
            Err(err) => {
                println!(
                    "Error {err} when parsing feed settings data = '{}'",
                    &feed_setting.data
                );
            }
        }
    }
    Ok(config)
}
