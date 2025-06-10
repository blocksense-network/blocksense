#![doc = "Volume Weighted Average Price"]

use crate::traits::prices_fetcher::PricePoint;
use anyhow::{Context, Result};

pub fn compute_vwap<'a>(price_points: impl IntoIterator<Item = &'a PricePoint>) -> Result<f64> {
    price_points
        .into_iter()
        .filter(|pp| pp.volume > 0.0)
        .map(|PricePoint { price, volume }| (price * volume, *volume))
        .reduce(|(num, denom), (weighted_price, volume)| (num + weighted_price, denom + volume))
        .context("No price points found")
        .map(|(weighted_prices_sum, total_volume)| weighted_prices_sum / total_volume)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_compute_vwap() {
        assert_eq!(
            compute_vwap(&[
                PricePoint {
                    price: 100.0,
                    volume: 10.0,
                },
                PricePoint {
                    price: 200.0,
                    volume: 20.0,
                },
                PricePoint {
                    price: 300.0,
                    volume: 30.0,
                },
            ])
            .unwrap(),
            233.33333333333334
        );
    }

    #[test]
    fn test_compute_vwap_empty() {
        assert!(compute_vwap(&[]).is_err());
    }
}
