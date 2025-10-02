use anyhow::{Context, Result};
use blocksense_sdk::http::http_get_json;
use serde::Deserialize;
use serde_this_or_that::as_f64;
use tracing::error;

pub const ETHERSCAN_GAS_ORACLE_URL: &str =
    "https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle";

#[derive(Debug, Deserialize)]
pub struct EtherscanResponse {
    pub result: GasOraclePayload,
}

#[derive(Debug, Deserialize)]
pub struct GasOraclePayload {
    #[serde(rename = "SafeGasPrice", deserialize_with = "as_f64")]
    pub safe_gas_price: f64,
    #[serde(rename = "ProposeGasPrice", deserialize_with = "as_f64")]
    pub propose_gas_price: f64,
    #[serde(rename = "FastGasPrice", deserialize_with = "as_f64")]
    pub fast_gas_price: f64,
    #[serde(rename = "suggestBaseFee", deserialize_with = "as_f64")]
    pub suggest_base_fee: f64,
}

impl GasOraclePayload {
    pub fn get_value_by_base(&self, base: &str) -> f64 {
        match base {
            "SafeGasPrice" => self.safe_gas_price,
            "ProposeGasPrice" => self.propose_gas_price,
            "FastGasPrice" => self.fast_gas_price,
            "suggestBaseFee" => self.suggest_base_fee,
            _ => self.propose_gas_price, // default fallback
        }
    }
}

pub async fn fetch_gas_oracle_data() -> Result<GasOraclePayload> {
    let response: EtherscanResponse = http_get_json(ETHERSCAN_GAS_ORACLE_URL, None, None, None)
        .await
        .context("Failed to fetch or decode gas oracle response JSON")
        .map_err(|e| {
            error!("Failed to fetch gas oracle: {}", e);
            e
        })?;

    Ok(response.result)
}
