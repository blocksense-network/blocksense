use anyhow::{anyhow, bail, Context, Result};
use blocksense_sdk::spin::{
    http::{send, Method, Request, Response},
    key_value::Store,
};
use futures::future::LocalBoxFuture;
use itertools::Itertools;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{
    collections::HashMap,
    hash::{DefaultHasher, Hash, Hasher},
};
use url::Url;

use crate::okx::fetch_okx_symbols;

pub const USD_SYMBOLS: [&str; 3] = ["USD", "USDC", "USDT"];

const SYMBOLS_KEY: &str = "symbols";
const RESOURCES_HASH_KEY: &str = "resources_hash";

type TradingPair = String;
type Price = String;
// type ExchangeId = String;

pub type PairPriceData = HashMap<TradingPair, Price>;

fn compute_resources_hash(resources: &[ResourceData]) -> u64 {
    let resource_hashes = resources
        .iter()
        .sorted_unstable_by(|a, b| Ord::cmp(&a.id, &b.id))
        .map(|entry| {
            let mut hasher = DefaultHasher::new();
            entry.hash(&mut hasher);
            hasher.finish()
        })
        .collect_vec();

    let mut hasher = DefaultHasher::new();
    resource_hashes.hash(&mut hasher);
    hasher.finish()
}

fn store_resources_hash(store: &mut Store, hash: u64) -> Result<()> {
    let bytes = hash.to_be_bytes();
    store
        .set(RESOURCES_HASH_KEY, &bytes)
        .with_context(|| format!("Could not set {RESOURCES_HASH_KEY}"))
}

fn get_stored_resources_hash(store: &Store) -> Result<u64> {
    let stored_hash_bytes: [u8; size_of::<u64>()] = store
        .get(RESOURCES_HASH_KEY)?
        .with_context(|| format!("Key {RESOURCES_HASH_KEY} is not set"))?
        .as_slice()
        .try_into()
        .with_context(|| format!("Key {RESOURCES_HASH_KEY} is not 8 bytes"))?;

    Ok(u64::from_be_bytes(stored_hash_bytes))
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SymbolsData {
    pub okx: Vec<TradingPair>,
}

impl SymbolsData {
    // NOTE: Passing resources in case we want to get the intersection of the symbols we want and
    // symbols the exchange supports
    pub async fn from_resources(_resources: &[ResourceData]) -> Result<Self> {
        Ok(Self {
            okx: fetch_okx_symbols().await?,
        })
    }

    pub fn load(store: &Store) -> Result<Self> {
        let symbols = store.get_json(SYMBOLS_KEY)?.ok_or_else(|| {
            anyhow!("Could not load {SYMBOLS_KEY} for exchanges from spin key-value store")
        })?;

        Ok(symbols)
    }

    pub fn store(&self, store: &mut Store) -> Result<()> {
        store.set_json(SYMBOLS_KEY, &self)
    }
}

pub fn okx_symbols_from_resources(resources: &[ResourceData]) -> Vec<String> {
    let quotes = resources.iter().map(|resource| &resource.symbol);
    let base_quote_pairs = USD_SYMBOLS.iter().cartesian_product(quotes);
    base_quote_pairs
        .map(|(base, quote)| format!("{quote}-{base}"))
        .collect()
}

pub async fn load_exchange_symbols(resources: &[ResourceData]) -> Result<SymbolsData> {
    let mut store = Store::open_default()?;

    let computed_resources_hash = compute_resources_hash(resources);

    let up_to_date =
        get_stored_resources_hash(&store).is_ok_and(|hash| hash == computed_resources_hash);

    let symbols = if up_to_date {
        // Try to load the symbols from store
        match SymbolsData::load(&store) {
            Ok(symbols) => symbols,
            Err(_) => {
                // The symbols schema has been altered, recreate and store them again
                let symbols = SymbolsData::from_resources(resources).await?;
                symbols.store(&mut store)?;
                symbols
            }
        }
    } else {
        // The cached symbols may be outdated as the resources have changed
        let symbols = SymbolsData::from_resources(resources).await?;
        symbols.store(&mut store)?;
        store_resources_hash(&mut store, computed_resources_hash)?;
        symbols
    };

    Ok(symbols)
}

#[derive(Debug, Hash)]
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
    resources: &[ResourceData],
    results: &mut HashMap<String, Vec<ResourceResult>>,
    response: HashMap<String, String>,
) -> Result<()> {
    //TODO(adikov): We need a proper way to get trade volume from Binance API.
    for resource in resources {
        // First USD pair found.
        for quote in USD_SYMBOLS {
            let trading_pair = format!("{}{}", resource.symbol, quote);
            if response.contains_key(&trading_pair) {
                //TODO(adikov): remove unwrap
                let res = results.entry(resource.id.clone()).or_default();
                res.push(ResourceResult {
                    id: resource.id.clone(),
                    symbol: resource.symbol.clone(),
                    usd_symbol: quote.to_string(),
                    result: response.get(&trading_pair).unwrap().clone(),
                });
                break;
            }
        }
    }

    Ok(())
}

pub trait PricesFetcher {
    fn fetch(&self) -> LocalBoxFuture<Result<PairPriceData>>;
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
pub fn prepare_get_request(base_url: &str, params: Option<&[(&str, &str)]>) -> Result<Request> {
    let url = match params {
        Some(p) => Url::parse_with_params(base_url, p)?,
        None => Url::parse(base_url)?,
    };

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url.as_str());
    req.header("Accepts", "application/json");

    Ok(req.build())
}

pub type QueryParam<'a, 'b> = (&'a str, &'b str);

pub async fn http_get_json<T>(url: &str, params: Option<&[QueryParam<'_, '_>]>) -> Result<T>
where
    T: DeserializeOwned,
{
    let request = prepare_get_request(url, params)?;
    let response: Response = send(request).await?;

    let status_code: u16 = *response.status();
    let request_successful = (200..=299).contains(&status_code);

    if !request_successful {
        bail!("HTTP get request error: returned status code {status_code}");
    }

    let body = response.body();
    serde_json::from_slice(body).map_err(Into::into)
}
