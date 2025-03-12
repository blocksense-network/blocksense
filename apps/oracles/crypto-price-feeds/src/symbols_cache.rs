use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::hash::{DefaultHasher, Hash, Hasher};

use anyhow::Context;
use blocksense_sdk::spin::key_value::Store;
use itertools::Itertools;

use crate::{
    common::{ExchangesSymbols, ResourceData, TradingPairSymbol},
    exchanges::{gemini::get_gemini_symbols, upbit::get_upbit_market},
};

const SYMBOLS_KEY: &str = "symbols";
const RESOURCES_HASH_KEY: &str = "resources_hash";

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SymbolsData {
    pub gemini: Vec<TradingPairSymbol>,
    pub upbit: Vec<TradingPairSymbol>,
}

impl SymbolsData {
    pub async fn from_resources(_exchanges_symbols: &ExchangesSymbols) -> Result<Self> {
        Ok(Self {
            gemini: get_gemini_symbols().await?,
            upbit: get_upbit_market().await?,
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

pub async fn load_exchange_symbols(
    resources: &[ResourceData],
    exchanges_symbols: &ExchangesSymbols,
) -> Result<SymbolsData> {
    let mut store = Store::open_default()?;

    let computed_resources_hash = compute_resources_hash(resources);

    let up_to_date =
        get_stored_resources_hash(&store).is_ok_and(|hash| hash == computed_resources_hash);

    let symbols = if up_to_date {
        // Try to load the symbols from store
        match SymbolsData::load(&store) {
            Ok(symbols) => symbols,
            Err(_) => {
                let symbols = SymbolsData::from_resources(exchanges_symbols).await?;
                symbols.store(&mut store)?;
                symbols
            }
        }
    } else {
        let symbols = SymbolsData::from_resources(exchanges_symbols).await?;
        symbols.store(&mut store)?;
        store_resources_hash(&mut store, computed_resources_hash)?;
        symbols
    };

    Ok(symbols)
}
