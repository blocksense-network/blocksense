use anyhow::{Error, Result};
use blocksense_sdk::{
    oracle::{Payload, Settings},
    oracle_component,
};

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    println!("Starting oracle component - Stock Price Feeds");
    println!("Settings: {:?}", settings.data_feeds);
    Err(Error::msg("Not implemented yet"))
}
