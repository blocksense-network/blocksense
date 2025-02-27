#![doc = "Volume Weighted Average Price"]

use anyhow::{bail, Context, Result};
use std::collections::HashMap;

use crate::common::ResourceResult;

pub fn vwap_0(results: &[ResourceResult]) -> Result<f64> {
    if results.is_empty() {
        bail!("Missing results");
    }

    //TODO(adikov): Implement vwap logic here.
    // Assume a five-minute chart. The calculation is the same regardless of what intraday time frame is used.
    // 1. Find the average price the stock traded at over the first five-minute period of the day.
    //    To do this, add the high, low, and close, then divide by three.
    //    Multiply this by the volume for that period. Record the result in a spreadsheet, under column PV (price, volume).
    // 2. Divide PV by the volume for that period. This will produce the VWAP.
    // 3. To maintain the VWAP throughout the day, continue to add the PV value from each period to the prior values.
    //    Divide this total by the total volume up to that point.
    //
    //   THIS IS NOT THE PROPER IMPLEMENTATION IT IS FOR TEST PURPOSES
    let mut sum: f64 = 0.0f64;
    for res in results {
        sum += res.price;
    }

    Ok(sum / results.len() as f64)
}

#[derive(Default, Debug, Clone, PartialEq)]
pub struct PricePoint {
    price: f64,
    volume: f64,
}

#[allow(dead_code)]
type ExchangePricePoints = HashMap<String, PricePoint>;

#[allow(dead_code)]
fn vwap(exchange_price_points: &ExchangePricePoints) -> Result<f64> {
    if exchange_price_points.is_empty() {
        return Err(anyhow::anyhow!("No price points found"));
    }
    let numerator: f64 = exchange_price_points
        .iter()
        .fold(0.0, |acc, (_, price_point)| {
            acc + price_point.volume * price_point.price
        });
    let denominator: f64 = exchange_price_points
        .iter()
        .fold(0.0, |acc, (_, price_point)| acc + price_point.volume);

    Ok(numerator / denominator)
}

#[allow(dead_code)]
pub fn compute_vwap(price_points: &[PricePoint]) -> Result<f64> {
    price_points
        .iter()
        .map(|PricePoint { price, volume }| (price * volume, *volume))
        .reduce(|(num, denom), (weighted_price, volume)| (num + weighted_price, denom + volume))
        .map(|(weighted_prices_sum, total_volume)| weighted_prices_sum / total_volume)
        .context("No price points found")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vwap() {
        let mut exchange_price_points: ExchangePricePoints = HashMap::new();
        exchange_price_points.insert(
            "exchange1".to_string(),
            PricePoint {
                price: 100.0,
                volume: 10.0,
            },
        );
        exchange_price_points.insert(
            "exchange2".to_string(),
            PricePoint {
                price: 200.0,
                volume: 20.0,
            },
        );
        exchange_price_points.insert(
            "exchange3".to_string(),
            PricePoint {
                price: 300.0,
                volume: 30.0,
            },
        );

        let result = vwap(&exchange_price_points).unwrap();
        assert_eq!(result, 233.33333333333334);
    }

    #[test]
    fn test_vwap_empty() {
        let exchange_price_points: ExchangePricePoints = HashMap::new();
        let result = vwap(&exchange_price_points);
        assert!(result.is_err());
    }

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
