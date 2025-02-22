use anyhow::Result;
use futures::future::LocalBoxFuture;

use crate::common::PairPriceData;

#[allow(dead_code)]
pub trait PricesFetcher {
    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>>;
}
