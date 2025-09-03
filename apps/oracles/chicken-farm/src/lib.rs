use anyhow::Result;

use serde::{Deserialize, Serialize};

use blocksense_sdk::{
    http::http_get_json,
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};
use tracing::info;

#[derive(Serialize, Deserialize, Debug)]
struct PricePair {
    pub base: String,
    pub quote: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct FeedConfigData {
    pub pair: PricePair,
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    tracing_subscriber::fmt::init();
    let supply = get_eggs_supply().await?;
    let price = get_eggs_price().await?;

    info!("Eggs supply: {}", supply);
    info!("Eggs price: {}", price);

    let mut payload = Payload::new();

    // Parse feed configurations and match by base asset
    for feed_setting in &settings.data_feeds {
        match serde_json::from_str::<FeedConfigData>(&feed_setting.data) {
            Ok(feed_config) => {
                let value = match feed_config.pair.base.to_lowercase().as_str() {
                    "supply" => DataFeedResultValue::Numerical(supply as f64),
                    "price" => DataFeedResultValue::Numerical(price),
                    _ => {
                        info!("Unknown feed base: {}", feed_config.pair.base);
                        continue;
                    }
                };

                payload.values.push(DataFeedResult {
                    id: feed_setting.id.clone(),
                    value,
                });
            }
            Err(err) => {
                info!("Error parsing feed config for {}: {}", feed_setting.id, err);
            }
        }
    }

    info!("Payload: {:?}", payload);
    Ok(payload)
}

#[derive(Serialize, Deserialize, Debug)]
struct SupplyResponse {
    pub quantity: u64,
}

async fn get_eggs_supply() -> Result<u64> {
    let url = "http://localhost:3001/api/supply";
    let response = http_get_json::<SupplyResponse>(url, None, None, Some(5)).await?;
    Ok(response.quantity)
}

#[derive(Serialize, Deserialize, Debug)]
struct PriceResponse {
    pub price: f64,
}

async fn get_eggs_price() -> Result<f64> {
    let url = "http://localhost:3001/api/price";
    let response = http_get_json::<PriceResponse>(url, None, None, Some(5)).await?;
    Ok(response.price)
}
