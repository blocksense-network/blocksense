use crate::http::http_post_json;
use alloy::{hex::ToHexExt, primitives::Bytes};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RequestEthCallParams {
    data: String,
    from: String,
    to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RequestEthCall {
    jsonrpc: String,
    method: String,
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

#[derive(Debug, Clone, Deserialize)]
pub enum EthCallError {
    Rpc { code: i32, message: String },
    EmptyResponse,
    Decode(String),
    Http(String),
}

pub type Result<T> = std::result::Result<T, EthCallError>;

pub async fn eth_call(rpc_url: &str, to: &str, calldata: &Bytes) -> Result<Bytes> {
    let params = RequestEthCallParams {
        data: calldata.0.encode_hex_upper_with_prefix(),
        from: "0x0000000000000000000000000000000000000000".to_string(),
        to: to.to_string(),
    };
    let req = RequestEthCall {
        jsonrpc: "2.0".to_string(),
        method: "eth_call".to_string(),
        id: 1,
        params: (params, "latest".to_string()),
    };
    let resp: RpcResponse = http_post_json(rpc_url, req, None)
        .await
        .map_err(|e| EthCallError::Http(e.to_string()))?;

    if let Some(err) = resp.error {
        return Err(EthCallError::Rpc {
            code: err.code,
            message: err.message,
        });
    }
    let hex = resp.result.ok_or(EthCallError::EmptyResponse)?;
    let raw = hex.trim_start_matches("0x");
    let bytes = alloy::hex::decode(raw).map_err(|e| EthCallError::Decode(e.to_string()))?;
    Ok(Bytes::from(bytes))
}
