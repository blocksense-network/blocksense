use anyhow::{bail, Result};
use blocksense_sdk::spin::http::{send, Method, Request, Response};
use serde::de::DeserializeOwned;
use url::Url;

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
    req.header("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
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
