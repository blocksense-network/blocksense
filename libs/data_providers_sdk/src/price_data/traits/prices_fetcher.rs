use std::collections::HashMap;

use anyhow::Result;
use futures::future::LocalBoxFuture;
use futures::FutureExt;

pub type TradingPairSymbol = String;
pub type Price = f64;
pub type Volume = f64;

#[derive(Clone, Debug)]
pub struct PricePoint {
    pub price: Price,
    pub volume: Volume,
}

pub type PairPriceData = HashMap<TradingPairSymbol, PricePoint>;

pub trait PricesFetcher<'a> {
    const NAME: &'static str;

    fn new(symbols: &'a [String], api_keys: Option<HashMap<String, String>>) -> Self;
    fn fetch(&self, timeout_secs: u64) -> LocalBoxFuture<Result<PairPriceData>>;
}

pub fn fetch<'a, PF>(
    symbols: &'a [String],
    api_keys: Option<HashMap<String, String>>,
    timeout_secs: u64,
) -> LocalBoxFuture<'a, (&'static str, Result<PairPriceData>)>
where
    PF: PricesFetcher<'a>,
{
    async move {
        let fetcher = PF::new(symbols, api_keys);
        let res = fetcher.fetch(timeout_secs).await;
        (PF::NAME, res)
    }
    .boxed_local()
}
