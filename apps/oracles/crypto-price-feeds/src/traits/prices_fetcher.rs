use anyhow::Result;
use futures::future::LocalBoxFuture;

use crate::common::PairPriceData;

pub trait PricesFetcher {
    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>>;
}
