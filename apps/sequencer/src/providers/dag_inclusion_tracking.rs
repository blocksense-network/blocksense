use std::cmp::max;
use std::time::{Duration, Instant};

use alloy::providers::Provider;
use alloy_primitives::{TxHash, B256};
use eyre::{eyre, Result, WrapErr};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::time::sleep;
use tracing::debug;

use crate::providers::provider::{ProviderType, RpcProvider};

/// Default number of extra DAG levels we require before declaring a tx
/// "sufficiently included". This value is intentionally small so the caller
/// can override it when wiring the helper.
pub const DEFAULT_REQUIRED_DAG_DEPTH: u64 = 5;
const DAG_INCLUSION_TIMEOUT: Duration = Duration::from_secs(10);
const DAG_POLL_INTERVAL: Duration = Duration::from_millis(500);
const DAG_LOOKBACK_MIN_LEVELS: u64 = 64;
const DAG_LOOKBACK_MARGIN: u64 = 8;

#[derive(Debug, Clone)]
pub struct DagInclusionStatus {
    pub tx_hash: TxHash,
    pub dag_block_hash: B256,
    pub dag_level: u64,
    pub depth_reached: u64,
    pub period: Option<u64>,
    pub elapsed: Duration,
}

#[derive(Debug, Clone, Deserialize)]
struct TaraxaDagBlock {
    pub hash: B256,
    #[serde(deserialize_with = "deserialize_hex_u64")]
    pub level: u64,
    #[serde(default, deserialize_with = "deserialize_optional_hex_u64")]
    pub period: Option<u64>,
    #[serde(default)]
    pub transactions: Vec<TxHash>,
}

/// Waits until the given transaction hash is observed inside a Taraxa DAG block
/// and that block accumulates at least `required_depth` additional DAG levels.
pub async fn wait_for_dag_inclusion(
    provider: &RpcProvider,
    tx_hash: TxHash,
    required_depth: u64,
) -> Result<DagInclusionStatus> {
    if required_depth == 0 {
        return Err(eyre!(
            "required_depth must be greater than zero when tracking DAG inclusion"
        ));
    }

    let rpc = &provider.provider;
    let start = Instant::now();
    let deadline = start + DAG_INCLUSION_TIMEOUT;

    let mut located_block: Option<TaraxaDagBlock> = None;

    loop {
        if Instant::now() >= deadline {
            break;
        }

        let current_level = fetch_current_dag_level(rpc).await?;

        if located_block.is_none() {
            located_block = search_recent_levels(rpc, &tx_hash, current_level, required_depth)
                .await
                .wrap_err("failed to search DAG levels for transaction")?;
            if let Some(block) = &located_block {
                debug!(
                    tx_hash = format!("{tx_hash:?}"),
                    dag_block = format!("{:?}", block.hash),
                    dag_level = block.level,
                    "Transaction observed in DAG block"
                );
            }
        }

        if let Some(block) = &located_block {
            let depth = current_level.saturating_sub(block.level);
            if depth >= required_depth {
                return finalize_status(rpc, tx_hash, block.clone(), depth, start).await;
            }
        }

        sleep(DAG_POLL_INTERVAL).await;
    }

    Err(eyre!(
        "timed out after {:?} waiting for DAG inclusion of tx {tx_hash:?}",
        DAG_INCLUSION_TIMEOUT
    ))
}

async fn finalize_status(
    rpc: &ProviderType,
    tx_hash: TxHash,
    block_hint: TaraxaDagBlock,
    depth: u64,
    started_at: Instant,
) -> Result<DagInclusionStatus> {
    let detailed = fetch_dag_block_by_hash(rpc, block_hint.hash).await?;
    let block = detailed.unwrap_or(block_hint);
    Ok(DagInclusionStatus {
        tx_hash,
        dag_block_hash: block.hash,
        dag_level: block.level,
        depth_reached: depth,
        period: block.period,
        elapsed: started_at.elapsed(),
    })
}

async fn search_recent_levels(
    rpc: &ProviderType,
    tx_hash: &TxHash,
    current_level: u64,
    required_depth: u64,
) -> Result<Option<TaraxaDagBlock>> {
    let lookback = max(
        DAG_LOOKBACK_MIN_LEVELS,
        required_depth + DAG_LOOKBACK_MARGIN,
    );
    let min_level = current_level.saturating_sub(lookback);
    let mut level = current_level;

    loop {
        let blocks = fetch_blocks_for_level(rpc, level).await?;
        if let Some(found) = blocks.into_iter().find(|block| {
            block
                .transactions
                .iter()
                .any(|hash_in_block| hash_in_block == tx_hash)
        }) {
            return Ok(Some(found));
        }

        if level == 0 || level == min_level {
            break;
        }
        level -= 1;
    }

    Ok(None)
}

async fn fetch_current_dag_level(rpc: &ProviderType) -> Result<u64> {
    let raw: Value = rpc
        .raw_request("taraxa_dagBlockLevel".into(), ())
        .await
        .wrap_err("taraxa_dagBlockLevel RPC call failed")?;
    parse_quantity_value(raw)
}

async fn fetch_blocks_for_level(rpc: &ProviderType, level: u64) -> Result<Vec<TaraxaDagBlock>> {
    let params = json!([format_hex_quantity(level), false]);
    let blocks: Option<Vec<TaraxaDagBlock>> = rpc
        .raw_request("taraxa_getDagBlockByLevel".into(), params)
        .await
        .wrap_err_with(|| format!("taraxa_getDagBlockByLevel failed for level {level}"))?;
    Ok(blocks.unwrap_or_default())
}

async fn fetch_dag_block_by_hash(rpc: &ProviderType, hash: B256) -> Result<Option<TaraxaDagBlock>> {
    let params = json!([hash, false]);
    rpc.raw_request("taraxa_getDagBlockByHash".into(), params)
        .await
        .wrap_err_with(|| format!("taraxa_getDagBlockByHash failed for {hash:?}"))
}

fn format_hex_quantity(value: u64) -> String {
    format!("0x{:x}", value)
}

fn parse_quantity_value(value: Value) -> Result<u64> {
    match value {
        Value::String(s) => parse_quantity_str(&s),
        Value::Number(num) => num
            .as_u64()
            .ok_or_else(|| eyre!("failed to decode quantity from number {num}")),
        other => Err(eyre!("unexpected quantity representation: {other:?}")),
    }
}

fn parse_quantity_str(input: &str) -> Result<u64> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(eyre!("empty quantity string"));
    }

    if let Some(without_prefix) = trimmed
        .strip_prefix("0x")
        .or_else(|| trimmed.strip_prefix("0X"))
    {
        if without_prefix.is_empty() {
            return Ok(0);
        }
        u64::from_str_radix(without_prefix, 16)
            .wrap_err_with(|| format!("invalid hex quantity: {trimmed}"))
    } else {
        trimmed
            .parse::<u64>()
            .wrap_err_with(|| format!("invalid decimal quantity: {trimmed}"))
    }
}

fn deserialize_hex_u64<'de, D>(deserializer: D) -> std::result::Result<u64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Value::deserialize(deserializer)?;
    parse_quantity_value(value).map_err(serde::de::Error::custom)
}

fn deserialize_optional_hex_u64<'de, D>(
    deserializer: D,
) -> std::result::Result<Option<u64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let opt = Option::<Value>::deserialize(deserializer)?;
    match opt {
        None => Ok(None),
        Some(value) => parse_quantity_value(value)
            .map(Some)
            .map_err(serde::de::Error::custom),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_hex_and_decimal_quantities() {
        assert_eq!(parse_quantity_str("0x10").unwrap(), 16);
        assert_eq!(parse_quantity_str("0X2a").unwrap(), 42);
        assert_eq!(parse_quantity_str("  25 ").unwrap(), 25);
    }

    #[test]
    fn parse_quantity_value_handles_numbers_and_strings() {
        assert_eq!(parse_quantity_value(json!("0x1")).unwrap(), 1);
        assert_eq!(parse_quantity_value(json!(17_u64)).unwrap(), 17);
    }

    #[test]
    fn format_hex_quantity_adds_prefix() {
        assert_eq!(format_hex_quantity(26), "0x1a");
    }
}
