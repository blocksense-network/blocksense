use anyhow::Result;

use serde::{Deserialize, Serialize};

use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue,Payload, Settings},
    oracle_component,
    http::http_get_json
};

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RWAResponse {
    pub asset_symbol: String,
    pub reserve_amount: Option<f64>,
    pub updated_at: String,
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    let resources = get_resources_from_settings(&settings)?;
    let timeout_secs = settings.interval_time_in_seconds - 1;
    let api_key: String = get_api_key(&settings)?;

    let url = resources.arguments.api_url;
    let response = http_get_json::<RWAResponse>(
        url.as_str(),
        None,
        Some(&[("X-API-Key", api_key.as_str())]),
        timeout_secs,
    ).await?;

    if resources.arguments.endpoint == "reserve" {
        let reserve_amount = response.reserve_amount.unwrap_or(0.0);

        let mut payload = Payload::new();
        payload.values.push(DataFeedResult {
            id: settings.data_feeds[0].id.clone(), // Assuming there's only one data feed
            value: DataFeedResultValue::Numerical(reserve_amount),
        });

        println!("Payload: {:?}", payload);
        Ok(payload)
    } else {
        Err(anyhow::anyhow!("Unsupported request type: {}", resources.arguments.endpoint))
    }
}

fn get_api_key(settings: &Settings) -> Result<String> {
    settings
        .capabilities
        .iter()
        .find(|cap| cap.id == "SPOUT_RWA_API_KEY")
        .map(|cap| cap.data.clone())
        .ok_or_else(|| anyhow::anyhow!("API key not found in capabilities"))
}

#[derive(Serialize, Deserialize, Debug)]
struct ResourceArguments {
    pub api_url: String,
    pub endpoint: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct ResourceData {
   pub arguments: ResourceArguments,
}

fn get_resources_from_settings(settings: &Settings) -> Result<ResourceData> {
    settings
        .data_feeds
        .get(0) // At this point we assume there's only one data feed
        .and_then(|feed| serde_json::from_str::<ResourceData>(&feed.data).ok())
        .ok_or_else(|| anyhow::anyhow!("Couldn't parse resource data from settings"))
}

