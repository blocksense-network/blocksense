use anyhow::Result;
use blocksense_sdk::spin::http::{Method, Request, Response};
use serde::de::DeserializeOwned;
use std::collections::HashMap;
use url::Url;

pub const USD_SYMBOLS: [&str; 3] = ["USD", "USDC", "USDT"];

pub type PairPriceData = HashMap<String, String>;

#[derive(Debug)]
pub struct ResourceData {
    pub symbol: String,
    pub id: String,
}

#[derive(Debug)]
#[allow(dead_code)] // We are not using this struct yet.
pub struct ResourceResult {
    pub id: String,
    pub symbol: String,
    pub usd_symbol: String,
    pub result: String,
    //TODO(adikov): Add balance information when we start getting it.
}

pub trait Fetcher {
    type ParsedResponse;
    type ApiResponse: DeserializeOwned; // Ensure it's deserializable

    fn prepare_get_request(
        &self,
        base_url: &str,
        params: Option<&[(&str, &str)]>,
    ) -> Result<Request> {
        let url = match params {
            Some(p) => Url::parse_with_params(base_url, p)?,
            None => Url::parse(base_url)?,
        };

        let mut req = Request::builder();
        req.method(Method::Get);
        req.uri(url.as_str());
        req.header("Accepts", "application/json");

        Ok(req.build())
    }

    fn deserialize_response(&self, resp: Response) -> Result<Self::ApiResponse> {
        let body = resp.into_body();
        serde_json::from_slice(&body).map_err(|e| e.into())
    }

    fn parse_response(&self, response: Self::ApiResponse) -> Result<Self::ParsedResponse>;
}
