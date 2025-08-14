use crate::errors::{OracleError, Result};
use alloy::primitives::Bytes;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RequestEthCallParams {
    data: String,
    from: String,
    to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RequestEthCall {
    jsonrpc: &'static str,
    method: &'static str,
    id: u64,
    params: (RequestEthCallParams, String),
}

#[derive(Debug, Clone, Deserialize)]
pub struct RpcError {
    pub message: String,
    pub code: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RpcResponse {
    pub jsonrpc: String,
    pub id: Option<u64>,
    pub error: Option<RpcError>,
    pub result: Option<String>,
}

pub async fn eth_call(rpc_url: &str, to: &str, calldata: &Bytes) -> Result<Bytes> {
    let params = RequestEthCallParams {
        data: calldata.0.encode_hex_upper_with_prefix(),
        from: "0x0000000000000000000000000000000000000000".into(),
        to: to.into(),
    };
    let req = RequestEthCall {
        jsonrpc: "2.0",
        method: "eth_call",
        id: 1,
        params: (params, "latest".into()),
    };
    let resp: RpcResponse = blocksense_sdk::http::http_post_json(rpc_url, req)
        .await
        .map_err(|e| OracleError::Http(e.to_string()))?;

    if let Some(err) = resp.error {
        return Err(OracleError::Rpc {
            code: err.code,
            message: err.message,
        });
    }
    let hex = resp.result.ok_or(OracleError::EmptyResponse)?;
    let raw = hex.trim_start_matches("0x");
    let bytes = alloy::hex::decode(raw).map_err(|e| OracleError::Decode(e.to_string()))?;
    Ok(Bytes::from(bytes))
}
