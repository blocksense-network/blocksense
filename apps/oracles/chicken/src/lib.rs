use anyhow::Result;

use serde::{Deserialize, Serialize};

use blocksense_sdk::{
    http::http_get_json,
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};
use tracing::info;

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    tracing_subscriber::fmt::init();
    let supply = get_eggs_supply().await?;
    let price = get_eggs_price().await?;

    info!("Eggs supply: {}", supply);
    info!("Eggs price: {}", price);

    let mut payload = Payload::new();
    payload.values.push(DataFeedResult {
        id: settings.data_feeds[0].id.clone(),
        value: DataFeedResultValue::Numerical(supply as f64),
    });
    payload.values.push(DataFeedResult {
        id: settings.data_feeds[1].id.clone(),
        value: DataFeedResultValue::Numerical(price),
    });

    info!("Payload: {:?}", payload);
    Ok(payload)
}

#[derive(Serialize, Deserialize, Debug)]
struct SupplyResponse {
    pub quantity: u64,
}

async fn get_eggs_supply() -> Result<u64> {
    let url = "http://localhost:8787/api/supply";
    let response = http_get_json::<SupplyResponse>(url, None, None, Some(5)).await?;
    Ok(response.quantity)
}

#[derive(Serialize, Deserialize, Debug)]
struct PriceResponse {
    pub price: f64,
}

async fn get_eggs_price() -> Result<f64> {
    let url = "http://localhost:8787/api/price";
    let response = http_get_json::<PriceResponse>(url, None, None, Some(5)).await?;
    Ok(response.price)
}
