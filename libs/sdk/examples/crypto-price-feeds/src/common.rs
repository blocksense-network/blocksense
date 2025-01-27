use anyhow::Result;
use std::collections::HashMap;

pub const USD_SYMBOLS: [&str; 3] = ["USD", "USDC", "USDT"];

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
