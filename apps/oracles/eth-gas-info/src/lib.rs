use anyhow::{Error, Result};
use tracing::info;
use blocksense_sdk::{
    oracle::{Payload, Settings},
    oracle_component,
};

#[oracle_component]
async fn oracle_request(_settings: Settings) -> Result<Payload> {
    tracing_subscriber::fmt::init();
    info!("Starting oracle component - eth-gas-info");
    Err(Error::msg("Not implemented yet"))
}
