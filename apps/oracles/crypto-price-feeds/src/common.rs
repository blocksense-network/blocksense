use std::collections::HashMap;

use anyhow::{bail, Result};
use blocksense_sdk::spin::http::{send, Method, Request, Response};
use serde::de::DeserializeOwned;
use url::Url;

pub const USD_SYMBOLS: [&str; 3] = ["USD", "USDC", "USDT"];

pub type TradingPair = String;
pub type Price = String;
pub type PairPriceData = HashMap<TradingPair, Price>;

#[derive(Debug, Hash)]
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

pub type QueryParam<'a, 'b> = (&'a str, &'b str);

pub fn prepare_get_request(
    base_url: &str,
    params: Option<&[QueryParam<'_, '_>]>,
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

pub async fn http_get_json<T>(url: &str, params: Option<&[QueryParam<'_, '_>]>) -> Result<T>
where
    T: DeserializeOwned,
{
    let request = prepare_get_request(url, params)?;
    let response: Response = send(request).await?;

    let status_code: u16 = *response.status();
    let request_successful = (200..=299).contains(&status_code);

    if !request_successful {
        bail!("HTTP get request error: returned status code {status_code}");
    }

    let body = response.body();
    serde_json::from_slice(body).map_err(Into::into)
}
