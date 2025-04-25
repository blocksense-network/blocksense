use std::str;

use anyhow::{bail, Result};
use serde::{de::DeserializeOwned, Serialize};
use spin_sdk::http::{send, Method, Request, Response};
use url::Url;

pub type QueryParam<'a, 'b> = (&'a str, &'b str);
pub type HeaderParam<'a, 'b> = (&'a str, &'b str);

pub fn prepare_get_request(
    base_url: &str,
    params: Option<&[QueryParam<'_, '_>]>,
    headers: Option<&[HeaderParam<'_, '_>]>,
) -> Result<Request> {
    let url = match params {
        Some(p) => Url::parse_with_params(base_url, p)?,
        None => Url::parse(base_url)?,
    };

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url.as_str());
    req.header("Accepts", "application/json");
    req.header("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");

    if let Some(hdrs) = headers {
        for (key, value) in hdrs {
            req.header(*key, *value);
        }
    }

    Ok(req.build())
}

pub async fn http_get_json<T>(
    url: &str,
    params: Option<&[QueryParam<'_, '_>]>,
    headers: Option<&[HeaderParam<'_, '_>]>,
) -> Result<T>
where
    T: DeserializeOwned,
{
    let request = prepare_get_request(url, params, headers)?;
    let response: Response = send(request).await?;

    let status_code: u16 = *response.status();
    let request_successful = (200..=299).contains(&status_code);

    if !request_successful {
        bail!("HTTP get request error: returned status code {status_code}");
    }

    let body = response.body();
    serde_json::from_slice(body).map_err(Into::into)
}

pub fn prepare_post_request<U>(base_url: &str, request_json: U) -> Result<Request>
where
    U: Serialize,
{
    let url = Url::parse(base_url)?;
    let mut req = Request::builder();
    let request_body = serde_json::to_string(&request_json)?;
    req.method(Method::Post);
    req.uri(url.as_str());
    req.header("Content-Type", "application/json");
    req.header("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
    req.body(request_body);
    Ok(req.build())
}

pub async fn http_post_json<U, T>(url: &str, request_json: U) -> Result<T>
where
    T: DeserializeOwned,
    U: Serialize,
{
    let request = prepare_post_request(url, request_json)?;
    let response: Response = send(request).await?;

    let status_code: u16 = *response.status();
    let request_successful = (200..=299).contains(&status_code);

    if !request_successful {
        bail!("HTTP get request error: returned status code {status_code}");
    }

    let body = response.body();
    serde_json::from_slice(body).map_err(Into::into)
}
