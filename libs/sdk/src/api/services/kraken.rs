use anyhow::Result;
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
    spin::http::{send, Method, Request, Response},
};
use std::collections::HashMap;

use serde::Deserialize;
use serde_json::Value;
use url::Url;

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct KrakenResource {
    pub kraken_symbol: String,
}

pub struct KrakenClient {
    client: String,

}


impl KrakenClient {
    pub fn new(client: &str) -> Self {
        Self {
            client
        }
    }
}

#[async_trait]
impl APIInterface for KrakenClient {
    pub async fn poll(&mut self, asset: &str) -> Result<String> {
        unimplemented!()
    } 

    pub async fn poll_batch(&mut self, asset: &[str]) -> Result<String> {

    }
}
