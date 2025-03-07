use anyhow::{Context, Ok, Result};
use blocksense_sdk::{
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
    spin::http::{conversions::IntoBody, send, Method, Request, Response},
};
use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use url::Url;

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
pub struct DictionaryValue {
    pub final_balance: u128,
    pub total_received: u128,
    pub n_tx: u64,
}

type Dictionary = HashMap<String, DictionaryValue>;

pub async fn fetch_balance(addresses: &Vec<String>) -> Result<Dictionary> {
    let base_url = "https://blockchain.info/balance";
    let url = Url::parse_with_params(base_url, &[("active", addresses.join("|"))])?;

    let mut req = Request::builder();
    req.method(Method::Get);
    req.uri(url);
    let resp: Response = send(req).await?;

    let body = resp.into_body();
    let string = String::from_utf8(body)?;

    let value: Dictionary = serde_json::from_str(&string)
        .context(format!("Couldn't parse response from {base_url} properly"))?;
    Ok(value)
}

impl AddrMappingsRows {
    pub fn collect_addresses(&self) -> Vec<String> {
        self.rows
            .iter()
            .map(|x| x.data.btc_address.clone())
            .collect::<Vec<String>>()
    }
}

#[oracle_component]
async fn oracle_request(_settings: Settings) -> Result<Payload> {
    println!("Starting oracle component - Exsat");

    let exsat = fetch_exsat_custody()
        .await
        .context("Failed to fetch exsat custody file from github")?;

    let mut total = 0_u128;
    let addrs_with_balance = fetch_balance(&exsat.custody_addresses).await?;
    for (_btc_address, balance) in addrs_with_balance.iter() {
        total += balance.final_balance;
    }
    for custody_id in exsat.custody_ids {
        let mut chunk = Some(AddrMappings::new(custody_id));
        while let Some(addrs) = chunk {
            let mappings = addrs.fetch_rows().await?;
            let addresses = mappings.collect_addresses();
            let addrs_with_balance = fetch_balance(&addresses).await?;
            for (_btc_address, balance) in addrs_with_balance.iter() {
                total += balance.final_balance;
            }
            chunk = addrs.next(&mappings);
        }
    }
    println!("TOTAL = {total} sats");
    let mut payload: Payload = Payload::new();
    payload.values.push(DataFeedResult {
        id: "606".to_string(),
        value: DataFeedResultValue::Numerical(total as f64),
    });
    Ok(payload)
}
