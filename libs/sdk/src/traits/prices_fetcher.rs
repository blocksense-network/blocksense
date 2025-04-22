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

    fn new(symbols: &'a [String]) -> Self;
    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>>;
}

pub fn fetch<'a, PF>(
    symbols: &'a [String],
) -> LocalBoxFuture<'a, (&'static str, Result<PairPriceData>)>
where
    PF: PricesFetcher<'a>,
{
    async {
        let fetcher = PF::new(symbols);
        let res = fetcher.fetch().await;
        (PF::NAME, res)
    }
    .boxed_local()
}
