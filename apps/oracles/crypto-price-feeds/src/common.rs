use anyhow::Result;
use std::collections::HashMap;

pub const USD_SYMBOLS: [&str; 3] = ["USD", "USDC", "USDT"];

pub type PairPriceData = HashMap<String, String>;

#[derive(Debug)]
pub struct ResourceData {
    pub symbol: String,
    pub id: String,
}

#[derive(Debug)]
#[allow(dead_code)] // We are not using this struct yet.
pub struct ResourceResult {
    pub id: String,
    pub symbol: String,
    pub usd_symbol: String,
    pub result: String,
    //TODO(adikov): Add balance information when we start getting it.
}

pub fn fill_results(
    resources: &Vec<ResourceData>,
    results: &mut HashMap<String, Vec<ResourceResult>>,
    response: HashMap<String, String>,
) -> Result<()> {
    //TODO(adikov): We need a proper way to get trade volume from Binance API.
    for resource in resources {
        // First USD pair found.
        for symbol in USD_SYMBOLS {
            let quote = format!("{}{}", resource.symbol, symbol);
            if response.contains_key(&quote) {
                //TODO(adikov): remove unwrap
                let res = results.entry(resource.id.clone()).or_default();
                res.push(ResourceResult {
                    id: resource.id.clone(),
                    symbol: resource.symbol.clone(),
                    usd_symbol: symbol.to_string(),
                    result: response.get(&quote).unwrap().clone(),
                });
                break;
            }
        }
    }

    Ok(())
}

#[derive(Default, Debug, Clone, PartialEq)]
pub struct PricePoint {
    price: f64,
    volume: f64,
}

#[allow(dead_code)]
type ExchangePricePoints = HashMap<String, PricePoint>;

#[allow(dead_code)]
fn wvap(exchange_price_points: &ExchangePricePoints) -> Result<f64> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wvap() {
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

        let result = wvap(&exchange_price_points).unwrap();
        assert_eq!(result, 233.33333333333334);
    }

    #[test]
    fn test_wvap_empty() {
        let exchange_price_points: ExchangePricePoints = HashMap::new();
        let result = wvap(&exchange_price_points);
        assert!(result.is_err());
    }
}
