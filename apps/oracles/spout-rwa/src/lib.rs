use anyhow::Result;
use serde::Deserialize;

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

    let api_key: String = get_api_key(&settings)?;

    let response = http_get_json::<RWAResponse>(
        "https://rwa-deploy-backend.onrender.com/reserves/LQD",
        None,
        Some(&[("X-API-Key", api_key.as_str())]),
    ).await?;

    let reserve_amount = response.reserve_amount.unwrap_or(0.0);
    // Scale to 6 decimals
    let scaled_amount = (reserve_amount * 1e6).round();

    let mut payload = Payload::new();
    payload.values.push(DataFeedResult {
        id: settings.data_feeds[0].id.clone(), // Assuming there's only one data feed
        value: DataFeedResultValue::Numerical(scaled_amount),
    });

    println!("Payload: {:?}", payload);
    Ok(payload)
}

fn get_api_key(settings: &Settings) -> Result<String> {
    settings
        .capabilities
        .iter()
        .find(|cap| cap.id == "SPOUT_RWA_API_KEY")
        .map(|cap| cap.data.clone())
        .ok_or_else(|| anyhow::anyhow!("API key not found in capabilities"))
}
