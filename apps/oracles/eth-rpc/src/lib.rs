use alloy::{
    hex::ToHexExt,
    primitives::{Address, Bytes, U256},
    providers::ProviderBuilder,
    sol,
};
use tracing::{info, warn};
use anyhow::Result;
use blocksense_sdk::{
    http::http_post_json,
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};
use itertools::zip;
use prettytable::{format, Cell, Row, Table};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use url::Url;

pub type FeedId = u128;

sol!(
    #[allow(missing_docs)]
    #[allow(clippy::too_many_arguments)]
    #[sol(rpc)]
    YieldFiyUSD,
    "src/abi/YieldFiyUSD.json"
);

sol!(
    #[allow(missing_docs)]
    #[allow(clippy::too_many_arguments)]
    #[sol(rpc)]
    VaultABI,
    "src/abi/VaultABI.json"
);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestEthCallParams {
    data: String,
    from: String,
    to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestEthCall {
    pub jsonrpc: String,
    pub method: String,
    pub id: FeedId,
    pub params: (RequestEthCallParams, String),
}

#[derive(Deserialize, Debug, Clone)]
pub struct ResponseEthCallError {
    pub message: String,
    pub code: i32,
}

#[derive(Deserialize, Debug, Clone)]
pub struct ResponseEthCall {
    pub jsonrpc: String,
    pub id: Option<FeedId>,
    pub error: Option<ResponseEthCallError>,
    pub result: Option<String>,
    #[serde(default)]
    pub rpc_url: Option<String>,
}

fn convert(x: [u8; 32]) -> ([u8; 16], [u8; 16]) {
    let arr: [[u8; 16]; 2] = unsafe { std::mem::transmute(x) };
    (arr[0], arr[1])
}

impl ResponseEthCall {
    pub fn result_as_u256(&self) -> Result<U256> {
        match &self.result {
            Some(v) => Ok(U256::from_str(v)?),
            None => {
                let message = if let Some(err) = &self.error {
                    err.message.clone()
                } else {
                    "Missing error".to_string()
                };
                Err(anyhow::anyhow!(message))
            }
        }
    }

    pub fn result_as_f64(&self) -> Result<f64> {
        let x = self.result_as_u256()?;
        let non_zero_bits = x.bit_len();
        // println!("Number of bits = {non_zero_bits}");
        if non_zero_bits > f64::MANTISSA_DIGITS as usize {
            warn!("f64 is not big enough to accuratly represent integer with {non_zero_bits} non zero bits");
        }
        if non_zero_bits > u128::BITS as usize {
            return Err(anyhow::anyhow!(
                "u128 is not big enough to fit integer with {non_zero_bits} non zero bits"
            ));
        }
        let be: [u8; 32] = x.to_be_bytes();
        let (_a, b) = convert(be);
        let u = u128::from_be_bytes(b);
        Ok(u as f64)
    }
}

impl RequestEthCall {
    pub fn latest(calldata: &Bytes, contract_address: &Address, id: FeedId) -> RequestEthCall {
        let params = RequestEthCallParams {
            data: calldata.0.encode_hex_upper_with_prefix(),
            from: "0x0000000000000000000000000000000000000000".to_string(),
            to: contract_address.to_string(),
        };

        RequestEthCall {
            jsonrpc: "2.0".to_string(),
            method: "eth_call".to_string(),
            id,
            params: (params, "latest".to_string()),
        }
    }
}

#[derive(Debug)]
struct FetchedDataForFeed {
    pub contacts: Vec<Contract>,
    pub responses: Vec<ResponseEthCall>,
}

type FetchedDataHashMap = HashMap<FeedId, FetchedDataForFeed>;
type MyProvider = alloy::providers::fillers::FillProvider<
    alloy::providers::fillers::JoinFill<
        alloy::providers::Identity,
        alloy::providers::fillers::JoinFill<
            alloy::providers::fillers::GasFiller,
            alloy::providers::fillers::JoinFill<
                alloy::providers::fillers::BlobGasFiller,
                alloy::providers::fillers::JoinFill<
                    alloy::providers::fillers::NonceFiller,
                    alloy::providers::fillers::ChainIdFiller,
                >,
            >,
        >,
    >,
    alloy::providers::RootProvider,
>;

async fn fetch_all(resourses: &[FeedConfig], timeout_secs: u64) -> Result<FetchedDataHashMap> {
    let mut res = FetchedDataHashMap::new();
    for feed_config in resourses {
        let mut responses = vec![];
        for contract in &feed_config.arguments.contracts {
            if let Some(value) = contract.fetch(feed_config.feed_id, timeout_secs).await {
                responses.push(value);
            }
        }
        res.insert(
            feed_config.feed_id,
            FetchedDataForFeed {
                contacts: feed_config.arguments.contracts.to_vec(),
                responses,
            },
        );
    }
    Ok(res)
}

impl Contract {
    pub fn prepare_request(&self, provider: MyProvider, id: FeedId) -> Option<RequestEthCall> {
        match self.method_name.as_str() {
            "convertToAssets" => Some(self.convert_to_assets(provider.clone(), id)),
            "exchangeRate" => Some(self.exchange_rate(provider.clone(), id)),
            _ => None,
        }
    }

    pub fn convert_to_assets(&self, provider: MyProvider, id: FeedId) -> RequestEthCall {
        let contact = VaultABI::new(self.address, provider.clone());
        let shares = self.param1.unwrap();
        let x = contact.convertToAssets(shares);
        let calldata = x.calldata().clone();
        RequestEthCall::latest(&calldata, &self.address, id)
    }

    pub fn exchange_rate(&self, provider: MyProvider, id: FeedId) -> RequestEthCall {
        let contact = YieldFiyUSD::new(self.address, provider.clone());
        let x = contact.exchangeRate();
        let calldata = x.calldata().clone();
        RequestEthCall::latest(&calldata, &self.address, id)
    }

    async fn fetch(&self, id: FeedId, timeout_secs: u64) -> Option<ResponseEthCall> {
        let mut last_value = None;
        for rpc_url_candidate in &self.rpc_urls {
            if let Ok(rpc_url) = rpc_url_candidate.as_str().parse::<Url>() {
                let provider = ProviderBuilder::new().connect_http(rpc_url.clone());
                let eth_call = match self.prepare_request(provider, id) {
                    Some(value) => value,
                    None => break,
                };
                if let Ok(mut value) =
                    http_post_json::<RequestEthCall, ResponseEthCall>(rpc_url.as_str(), eth_call, Some(timeout_secs))
                        .await
                {
                    value.rpc_url = Some(rpc_url_candidate.clone());
                    if value.error.is_none() {
                        return Some(value);
                    } else {
                        last_value = Some(value);
                    }
                }
            }
        }
        last_value
    }
}

fn process_results(results: &FetchedDataHashMap, resourses: &[FeedConfig]) -> Result<Payload> {
    let mut payload: Payload = Payload::new();
    for (feed_id, r) in results {
        let mut sum = 0_f64;
        let mut weight = 0.0;
        let mut error = None;
        for resp in &r.responses {
            match resp.result_as_f64() {
                Ok(x) => {
                    sum += x;
                    weight += 1.0_f64;
                }
                Err(e) => error = Some(DataFeedResultValue::Error(e.to_string())),
            };
        }
        let value = if sum > 0.0_f64 {
            let div = if let Some(div) = resourses
                .iter()
                .find(|x| x.feed_id == *feed_id)
                .and_then(|x| x.arguments.divisor)
            {
                weight * div
            } else {
                weight
            };
            DataFeedResultValue::Numerical(sum / div)
        } else {
            match error {
                Some(err) => err,
                None => DataFeedResultValue::Error("No data".to_string()),
            }
        };
        let data_feed_result = DataFeedResult {
            id: feed_id.to_string(),
            value,
        };
        payload.values.push(data_feed_result);
    }
    Ok(payload)
}

fn print_responses(results: &FetchedDataHashMap) {
    let mut feed_ids = results.keys().cloned().collect::<Vec<FeedId>>();
    feed_ids.sort();

    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);

    table.set_titles(Row::new(vec![
        Cell::new("Feed ID").style_spec("bc"),
        Cell::new("Label").style_spec("bc"),
        Cell::new("Method").style_spec("bc"),
        Cell::new("Raw response").style_spec("bc"),
        Cell::new("RPC Url").style_spec("bc"),
        Cell::new("Contract").style_spec("bc"),
    ]));

    for feed_id in feed_ids {
        let res = results.get(&feed_id).unwrap();
        for (resp, contact) in zip(&res.responses, &res.contacts) {
            let rpc_url = format!("{:?}", resp.rpc_url.clone());
            let value = format!("{:?}", resp.result_as_f64());
            table.add_row(Row::new(vec![
                Cell::new(&feed_id.to_string()).style_spec("r"),
                Cell::new(&contact.label).style_spec("l"),
                Cell::new(&contact.method_name).style_spec("r"),
                Cell::new(&value).style_spec("r"),
                Cell::new(&rpc_url).style_spec("r"),
                Cell::new(&contact.address.to_string()).style_spec("r"),
            ]));
        }
    }

    table.printstd();
}

fn print_payload(payload: &Payload, resourses: &[FeedConfig]) {
    let mut feed_ids = resourses.iter().map(|x| x.feed_id).collect::<Vec<FeedId>>();
    feed_ids.sort();

    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);

    table.set_titles(Row::new(vec![
        Cell::new("Feed ID").style_spec("bc"),
        Cell::new("Pair").style_spec("bc"),
        Cell::new("Value").style_spec("bc"),
    ]));

    for feed_id in feed_ids {
        let x = payload
            .values
            .iter()
            .find(|x| x.id.parse::<FeedId>().unwrap() == feed_id)
            .unwrap();
        let pair = resourses
            .iter()
            .find(|r| r.feed_id == feed_id)
            .map(|x| format!("{} / {}", x.pair.base, x.pair.quote))
            .unwrap_or("unknown".to_string());
        let value = format!("{:?}", &x.value);
        table.add_row(Row::new(vec![
            Cell::new(&feed_id.to_string()).style_spec("r"),
            Cell::new(&pair).style_spec("r"),
            Cell::new(&value).style_spec("l"),
        ]));
    }
    table.printstd();
}

fn print_results(results: &FetchedDataHashMap, payload: &Payload, resourses: &[FeedConfig]) {
    print_responses(results);
    print_payload(payload, resourses);
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    tracing_subscriber::fmt::init();

    info!("Starting oracle component - Ethereum RPC");
    let timeout_secs = settings.interval_time_in_seconds - 1;
    let resources = get_resources_from_settings(&settings)?;
    let results = fetch_all(&resources, timeout_secs).await?;
    let payload = process_results(&results, &resources)?;
    print_results(&results, &payload, &resources);
    Ok(payload)
}

#[derive(Deserialize, Debug)]
pub struct Pair {
    pub base: String,
    pub quote: String,
}

#[derive(Default, Debug, Clone, PartialEq, Deserialize)]
pub struct VaultFeedConfig {
    #[serde(default)]
    pub feed_id: String,
    pub network: String,
    pub pool: String,
    pub reverse: bool,
    #[serde(default)]
    pub min_volume_usd: Option<f64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Contract {
    pub rpc_urls: Vec<String>,
    pub address: Address,
    pub label: String,
    pub method_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub param1: Option<U256>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct PairDescription {
    base: String,
    quote: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct OracleArgs {
    pub contracts: Vec<Contract>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub divisor: Option<f64>,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
struct FeedConfig {
    #[serde(default)]
    pub feed_id: FeedId,
    pub pair: PairDescription,
    #[serde(default)]
    pub decimals: u32,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub market_hours: String,
    pub arguments: OracleArgs,
}

fn get_resources_from_settings(settings: &Settings) -> Result<Vec<FeedConfig>> {
    let mut config: Vec<FeedConfig> = Vec::new();
    for feed_setting in &settings.data_feeds {
        match serde_json::from_str::<FeedConfig>(&feed_setting.data) {
            Ok(mut feed_config) => {
                feed_config.feed_id = feed_setting.id.parse::<FeedId>()?;
                config.push(feed_config);
            }
            Err(err) => {
                warn!(
                    "Error {err} when parsing feed settings data = '{}'",
                    &feed_setting.data
                );
            }
        }
    }
    Ok(config)
}

#[cfg(test)]
mod tests {
    use crate::{Contract, FeedConfig, OracleArgs, PairDescription, ResponseEthCall};
    use alloy::primitives::{address, U256};

    #[test]
    fn test_deserializion_of_error() {
        let raw_response = r#"{"jsonrpc":"2.0","id":100020,"error":{"code":3,"data":"0x4e487b710000000000000000000000000000000000000000000000000000000000000032","message":"execution reverted: panic: array out-of-bounds access (0x32)"}}"#;
        let value: ResponseEthCall = serde_json::from_str(raw_response).unwrap();
        assert_eq!(value.jsonrpc, "2.0");
        assert_eq!(value.id, Some(100020));
        assert!(value.error.is_some());
        let e = value.error.unwrap();
        assert_eq!(e.code, 3);
        assert_eq!(
            e.message,
            "execution reverted: panic: array out-of-bounds access (0x32)"
        );
    }

    #[test]
    fn test_deserializion_of_error_2() {
        let raw_response =
            r#"{"jsonrpc":"","id":null,"error":{"message":"method  not supported","code":-32603}}"#;
        let value: ResponseEthCall = serde_json::from_str(raw_response).unwrap();
        assert!(value.error.is_some());
    }

    #[test]
    fn test_deserializion_of_result() {
        let raw_response = r#"{"jsonrpc":"2.0","id":100,"result":"0x0000000000000000000000000000000000000000000000000000000000000000"}"#;
        let value: ResponseEthCall = serde_json::from_str(raw_response).unwrap();
        assert_eq!(value.jsonrpc, "2.0");
        assert_eq!(value.id, Some(100));
        assert!(value.error.is_none());
        assert!(value.result.is_some());
        assert_eq!(value.result_as_u256().unwrap(), U256::ZERO);
    }

    #[test]
    fn test_serialization_of_settings() {
        let m = FeedConfig {
            feed_id: 100,
            pair: PairDescription {
                base: "oLP".to_string(),
                quote: "USDC".to_string(),
            },
            market_hours: "Crypto".to_string(),
            category: "".to_string(),
            decimals: 0,
            arguments: OracleArgs {
                divisor: 50_f64.into(),
                contracts: vec![
                    Contract {
                        address: address!("0x657d9ABA1DBb59e53f9F3eCAA878447dCfC96dCb"),
                        rpc_urls: vec![
                            "https://eth.llamarpc.com".to_string(),
                            "https://rpc.eth.gateway.fm".to_string(),
                            "https://ethereum-rpc.publicnode.com".to_string(),
                        ],
                        label: "some_label".to_string(),
                        method_name: "convertToAssets".to_string(),
                        param1: None,
                    },
                    Contract {
                        address: address!("0x20d419a8e12c45f88fda7c5760bb6923cee27f98"),
                        rpc_urls: vec![
                            "https://eth.llamarpc.com".to_string(),
                            "https://rpc.eth.gateway.fm".to_string(),
                            "https://ethereum-rpc.publicnode.com".to_string(),
                        ],
                        label: "other_label".to_string(),
                        method_name: "method_1".to_string(),
                        param1: Some(U256::from(1000000000000000000_u128)),
                    },
                ],
            },
        };
        let expected = r#"{"feed_id":100,"pair":{"base":"oLP","quote":"USDC"},"decimals":0,"category":"","market_hours":"Crypto","arguments":{"contracts":[{"rpc_urls":["https://eth.llamarpc.com","https://rpc.eth.gateway.fm","https://ethereum-rpc.publicnode.com"],"address":"0x657d9aba1dbb59e53f9f3ecaa878447dcfc96dcb","label":"some_label","method_name":"convertToAssets"},{"rpc_urls":["https://eth.llamarpc.com","https://rpc.eth.gateway.fm","https://ethereum-rpc.publicnode.com"],"address":"0x20d419a8e12c45f88fda7c5760bb6923cee27f98","label":"other_label","method_name":"method_1","param1":"0xde0b6b3a7640000"}],"divisor":50.0}}"#;
        let serialized = serde_json::ser::to_string(&m).unwrap();
        assert_eq!(expected, serialized);
    }
}
