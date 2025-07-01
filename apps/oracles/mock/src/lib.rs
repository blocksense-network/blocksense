use anyhow::{Context, Result};
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
struct Data {
    pub pair: TradingPair,
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    println!("Starting oracle component");

    let resources = get_resources_from_settings(&settings)?;
    let payload = Payload {
        values: resources
            .pairs
            .iter()
            .map(|pair| DataFeedResult {
                id: pair.id.clone(),
                value: DataFeedResultValue::Numerical(100.0), // Mock data
            })
            .collect(),
    };

    println!("Generated payload: {payload:?}");
    Ok(payload)
}

#[derive(Debug)]
pub struct ResourceData {
    pub pairs: Vec<ResourcePairData>,
}

fn get_resources_from_settings(settings: &Settings) -> Result<ResourceData> {
    let mut price_feeds = Vec::new();

    for feed_setting in &settings.data_feeds {
        let feed_config =
            serde_json::from_str::<Data>(&feed_setting.data).context("Couldn't parse data feed")?;
        price_feeds.push(ResourcePairData {
            pair: feed_config.pair,
            id: feed_setting.id.clone(),
        });
    }

    Ok(ResourceData { pairs: price_feeds })
}

#[derive(Debug, Hash, Serialize, Deserialize)]
pub struct TradingPair {
    pub base: String,
    pub quote: String,
}

#[derive(Debug)]
pub struct ResourcePairData {
    pub pair: TradingPair,
    pub id: String,
}
