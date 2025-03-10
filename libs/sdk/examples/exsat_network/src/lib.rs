use anyhow::{Context, Ok, Result};
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
    spin::http::{conversions::IntoBody, send, Method, Request, Response},
    spin::key_value::Store,
};
use data::hardcoded_data;
use std::collections::HashMap;
use std::{thread, time::Duration};

use serde::{Deserialize, Serialize};
use url::Url;
mod data;

#[derive(Debug, Default, Clone, Deserialize)]
pub struct ExsatCustody {
    pub custody_ids: Vec<u32>,
    pub custody_addresses: Vec<String>,
}

pub async fn fetch_exsat_custody() -> Result<ExsatCustody> {
    let url = "https://raw.githubusercontent.com/exsat-network/exsat-defillama/refs/heads/main/bridge-bitcoin.json";
    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    let resp: Response = send(req).await?;
    let body = resp.into_body();
    let string = String::from_utf8(body)?;
    let value: ExsatCustody = serde_json::from_str(&string)
        .context("Couldn't parse bridge-bitcoin.json from github response properly")?;
    Ok(value)
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct AddrMappings {
    pub json: bool,
    pub code: String,
    pub scope: u32,
    pub table: String,
    pub lower_bound: Option<String>,
    pub upper_bound: Option<String>,
    pub index_position: u32,
    pub limit: String,
    pub key_type: String,
    pub reverse: bool,
    pub show_payer: bool,
}

impl AddrMappings {
    fn new(custody_id: u32) -> AddrMappings {
        AddrMappings {
            json: true,
            code: "brdgmng.xsat".to_string(),
            scope: custody_id,
            table: "addrmappings".to_string(),
            lower_bound: None,
            upper_bound: None,
            index_position: 1,
            key_type: "".to_string(),
            limit: "100".to_string(),
            reverse: false,
            show_payer: true,
        }
    }

    pub fn next(&self, prev: &AddrMappingsRows) -> Option<AddrMappings> {
        if prev.more {
            let mut res = self.clone();
            res.lower_bound = Some(prev.next_key.clone());
            Some(res)
        } else {
            None
        }
    }

    pub async fn fetch_rows(&self) -> Result<AddrMappingsRows> {
        let url = "https://rpc-us.exsat.network/v1/chain/get_table_rows";
        let mut req = Request::builder();
        req.method(Method::Post);
        req.uri(url);
        let data = serde_json::to_string(&self)?;
        req.body(data.into_body());
        let resp: Response = send(req).await?;
        let body = resp.into_body();
        let string = String::from_utf8(body)?;
        let value: AddrMappingsRows = serde_json::from_str(&string)
            .context(format!("Couldn't parse response from {url} properly"))?;
        Ok(value)
    }
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct AddrMappingData {
    // pub id: u32,
    // pub b_id: String,
    // pub wallet_code: String,
    pub btc_address: String,
    // pub evm_address: String,
    // pub last_bridge_time: String,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct AddrMappingsRow {
    pub data: AddrMappingData,
    // pub payer: String,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct AddrMappingsRows {
    pub rows: Vec<AddrMappingsRow>,
    pub more: bool,
    pub next_key: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BTCAddressValue {
    pub final_balance: u128,
    pub total_received: u128,
    pub n_tx: u64,
}

type Dictionary = HashMap<String, BTCAddressValue>;



pub async fn fetch_balance(addresses: &Vec<String>, store: &Store) -> Result<Dictionary> {
    let base_url = Url::parse("https://mempool.space/api/address/").expect("msg");
    //let url = Url::parse_with_params(base_url, &[("active", addresses.join("|"))])?;
    let mut res = Dictionary::new();
    for address in addresses {
        if store.exists(&address.as_str())? {
            continue;
        }

        let url = base_url.join(address.as_str()).expect("msg");
        let mut req = Request::builder();
        req.method(Method::Get);
        req.uri(url);
        let resp: Response = send(req).await?;

        let body = resp.into_body();
        let string = String::from_utf8(body)?;
        let value: BTCAddressStats = serde_json::from_str(&string)
            .context(format!("Couldn't parse response from {base_url} properly"))?;
        println!(
            "adding {} with {} sats {value:?}",
            value.address,
            value.balance()
        );
        res.insert(value.address.clone(), value.pending());
        thread::sleep(Duration::from_millis(1000));
    }
    Ok(res)
}

impl AddrMappingsRows {
    pub fn collect_addresses(&self) -> Vec<String> {
        self.rows
            .iter()
            .map(|x| x.data.btc_address.clone())
            .collect::<Vec<String>>()
    }
}

fn initialize_store_from_hardcoded_data() -> Result<Store> {
    let store = Store::open_default()?;
    let hardcoded_data = hardcoded_data();
    for stats in &hardcoded_data {
        if !store.exists(&stats.address)? {
            if stats.should_skip() {
                store.set_json(stats.address.as_str(), stats)?;
            }
        } else {
            break;
        }
    }
    Ok(store)
}


#[oracle_component]
async fn oracle_request(_settings: Settings) -> Result<Payload> {
    println!("Starting oracle component - Exsat");

    let store = initialize_store_from_hardcoded_data()?;

    let exsat = fetch_exsat_custody()
        .await
        .context("Failed to fetch exsat custody file from github")?;

    let mut total = 0_u128;
    let addrs_with_balance = fetch_balance(&exsat.custody_addresses, &store).await?;
    for (_btc_address, balance) in addrs_with_balance.iter() {
        total += balance.final_balance;
    }
    for custody_id in exsat.custody_ids {
        let mut chunk = Some(AddrMappings::new(custody_id));
        while let Some(addrs) = chunk {
            let mappings = addrs.fetch_rows().await?;
            let addresses = mappings.collect_addresses();
            println!("Processing chunk of {} addresses", addresses.len());
            let addrs_with_balance = fetch_balance(&addresses, &store).await?;
            for (_btc_address, balance) in addrs_with_balance.iter() {
                total += balance.final_balance;
            }
            println!("current sum = {total} sats");
            chunk = addrs.next(&mappings);
        }
    }
    println!("💰💰💰 TOTAL = {total} sats 💰💰💰");
    let mut payload: Payload = Payload::new();
    payload.values.push(DataFeedResult {
        id: "606".to_string(),
        value: DataFeedResultValue::Numerical(total as f64),
    });
    Ok(payload)
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct Stats {
    pub funded_txo_count: u64,
    pub funded_txo_sum: u128,
    pub spent_txo_count: u64,
    pub spent_txo_sum: u128,
    pub tx_count: u64,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct BTCAddressStats {
    pub address: String,
    pub chain_stats: Stats,
    pub mempool_stats: Stats,
}

impl BTCAddressStats {
    pub fn balance(&self) -> u128 {
        let mut res = self.chain_stats.funded_txo_sum - self.chain_stats.spent_txo_sum;
        res += self.mempool_stats.funded_txo_sum;
        res -= self.mempool_stats.spent_txo_sum;
        res
    }
    pub fn pending(&self) -> BTCAddressValue {
        BTCAddressValue {
            final_balance: self.balance(),
            total_received: self.chain_stats.funded_txo_sum + self.mempool_stats.funded_txo_sum,
            n_tx: self.chain_stats.tx_count + self.mempool_stats.tx_count,
        }
    }
    pub fn should_skip(&self) -> bool {
        0 == self.chain_stats.funded_txo_sum - self.chain_stats.spent_txo_sum
    }
}

#[cfg(test)]
mod tests {
    use crate::data::hardcoded_data;

    use super::*;

    #[test]
    fn test_deserialize_btc_address_response() {
        let string = r#"
        {
            "address": "16NTUUsoetDdEUcsxYLaiyFo7PnH97qSXk",
            "chain_stats": {
                "funded_txo_count": 2,
                "funded_txo_sum": 1397000,
                "spent_txo_count": 1,
                "spent_txo_sum": 1000000,
                "tx_count": 3
            },
            "mempool_stats": {
                "funded_txo_count": 0,
                "funded_txo_sum": 0,
                "spent_txo_count": 1,
                "spent_txo_sum": 397000,
                "tx_count": 1
            }
        }"#;

        let value: BTCAddressStats = serde_json::from_str(&string).unwrap();

        assert_eq!(value.address, "16NTUUsoetDdEUcsxYLaiyFo7PnH97qSXk");
        assert_eq!(value.chain_stats.funded_txo_count, 2);
        assert_eq!(value.chain_stats.funded_txo_sum, 1397000);
        assert_eq!(value.chain_stats.spent_txo_count, 1);
        assert_eq!(value.chain_stats.spent_txo_sum, 1000000);
        assert_eq!(value.chain_stats.tx_count, 3);

        assert_eq!(value.mempool_stats.funded_txo_count, 0);
        assert_eq!(value.mempool_stats.funded_txo_sum, 0);
        assert_eq!(value.mempool_stats.spent_txo_count, 1);
        assert_eq!(value.mempool_stats.spent_txo_sum, 397000);
        assert_eq!(value.mempool_stats.tx_count, 1);

        assert_eq!(value.balance(), 0);
    }

    #[test]
    fn test_skip_criteria() {
        assert!(BTCAddressStats {
            address: "1EDrH65dJ7Ht3sGQpKiCiBAFYzpSmoadj".to_string(),
            chain_stats: Stats {
                funded_txo_count: 1,
                funded_txo_sum: 10000,
                spent_txo_count: 1,
                spent_txo_sum: 10000,
                tx_count: 2,
            },
            mempool_stats: Stats {
                funded_txo_count: 0,
                funded_txo_sum: 0,
                spent_txo_count: 0,
                spent_txo_sum: 0,
                tx_count: 0,
            },
        }.should_skip() == true);

        assert!(BTCAddressStats {
            address: "1Jyd68zmusiYVFD2MneCKrB4qDmG5E2YhQ".to_string(),
            chain_stats: Stats {
                funded_txo_count: 2,
                funded_txo_sum: 300299059,
                spent_txo_count: 0,
                spent_txo_sum: 0,
                tx_count: 2,
            },
            mempool_stats: Stats {
                funded_txo_count: 0,
                funded_txo_sum: 0,
                spent_txo_count: 0,
                spent_txo_sum: 0,
                tx_count: 0,
            },
        }.should_skip() == false);
    }


    #[test]
    fn test_skip_with_mempool_criteria() {
        let data = hardcoded_data();
        let mut count = 0;
        for stat in data {
            if !stat.should_skip() {
                println!("{} Mempool stats at address = {}", count, stat.address);
                count += 1;
            }
        }
    }    
}
