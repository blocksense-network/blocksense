use std::collections::HashMap;

use anyhow::Result;
use futures::future::LocalBoxFuture;
use futures::FutureExt;

pub trait SportsFetcher {
    fn new(id: u64, api_keys: Option<HashMap<String, String>>) -> Self;
    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<'_, Result<Vec<u8>>>;
}

pub fn fetch<'a, PF>(
    id: u64,
    sport_type: String,
    api_keys: Option<HashMap<String, String>>,
    timeout_secs: u64,
) -> LocalBoxFuture<'a, (String, Result<Vec<u8>>)>
where
    PF: SportsFetcher,
{
    async move {
        let fetcher = PF::new(id, api_keys);
        let res = fetcher.fetch(timeout_secs).await;
        (sport_type, res)
    }
    .boxed_local()
}
