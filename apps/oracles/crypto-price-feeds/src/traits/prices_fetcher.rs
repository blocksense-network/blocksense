use anyhow::Result;
use futures::future::LocalBoxFuture;

use crate::common::PairPriceData;

pub trait PricesFetcher<'a> {
    const NAME: &'static str;

    fn new(symbols: &'a [String]) -> Self;
    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>>;
}
