#![doc = "Volume Weighted Average Price"]

use anyhow::{bail, Result};

use crate::common::ResourceResult;

#[derive(Default, Debug, Clone, PartialEq)]
pub struct PricePoint {
    price: f64,
    volume: f64,
}

pub fn vwap(results: &[ResourceResult]) -> Result<f64> {
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
        sum += res.result.parse::<f64>()?;
    }

    Ok(sum / results.len() as f64)
}

#[allow(dead_code)]
pub fn compute_vwap(price_points: &[PricePoint]) -> Result<f64> {
    if price_points.is_empty() {
        bail!("No price points found");
    }

    let (numerator, denominator) = price_points.iter().fold(
        (0.0, 0.0),
        |(numerator, denominator), PricePoint { price, volume }| {
            (numerator + volume * price, denominator + volume)
        },
    );

    Ok(numerator / denominator)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wvap() {
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
    fn test_wvap_empty() {
        assert!(compute_vwap(&[]).is_err());
    }
}
