use anyhow::Result;
use async_trait::async_trait;
use std::collections::HashMap;

use crate::oracle::Payload;

#[async_trait]
pub trait DataProvider {
    async fn fetch(&self, symbols: Vec<String>) -> Result<HashMap<String, f64>>;
}

pub struct OraclePriceHelper {
    pub data_providers: Vec<Box<dyn DataProvider>>,
}

impl OraclePriceHelper {
    pub fn new(data_providers: Vec<Box<dyn DataProvider>>) -> Self {
        Self { data_providers }
    }

    pub async fn generate_payload(&self) -> Result<Payload> {
        //TODO(adikov): Here we need to handle different types of result aggregation or fallback
        // ex.
        // 1. Avarage price which is configurable per feed. We also need weigh per data provider.
        // 2. Fallback mechanism with data provider priority.
        for provider in &self.data_providers {
            let _data = provider.fetch(vec![]).await?;
            //TODO(adikov): Transform all data to DataFeedResult
        }
        Ok(Payload::new())
    }
}
