#![doc = "Volume Weighted Average Price"]

use anyhow::{Context, Result};

use crate::common::{ExchangePricePoints, PricePoint};

#[allow(dead_code)]
pub fn vwap(exchange_price_points: &ExchangePricePoints) -> Result<f64> {
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
        let mut exchange_price_points: ExchangePricePoints = std::collections::HashMap::new();
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
        let exchange_price_points: ExchangePricePoints = std::collections::HashMap::new();
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
