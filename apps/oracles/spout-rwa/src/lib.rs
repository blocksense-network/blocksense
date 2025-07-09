use anyhow::{Context, Result};
use blocksense_sdk::{
    oracle::{Payload, Settings},
    oracle_component,
};

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    Err(anyhow::anyhow!(
        "This oracle is not implemented yet"
    ))
}
