use alloy::sol_types::SolCall;
use alloy::{
    hex::ToHexExt,
    hex::{decode, encode},
    primitives::{address, Address, Bytes, U256},
    providers::ProviderBuilder,
    sol,
};
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

sol!(
    #[allow(missing_docs)]
    #[allow(clippy::too_many_arguments)]
    #[sol(rpc)]
    UiPoolDataProvider,
    "src/abi/x.json"
);


const SECONDS_PER_YEAR_F64: f64 = 31_536_000.0;
const RAY_F64: f64 = 1e27;

const HYPURRFI_UI_POOL_DATA_PROVIDER: Address =
    address!("0x7b883191011AEAe40581d3Fa1B112413808C9c00");
const HYPURRFI_POOL_ADDRESSES_PROVIDER: Address =
    address!("0xA73ff12D177D8F1Ec938c3ba0e87D33524dD5594");
const HYPERLAND_UI_POOL_DATA_PROVIDER: Address =
    address!("0x3Bb92CF81E38484183cc96a4Fb8fBd2d73535807");
const HYPERLAND_POOL_ADDRESSES_PROVIDER: Address =
    address!("0x72c98246a98bFe64022a3190e7710E157497170C");

pub type FeedId = u128;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RequestEthCallParams {
    data: String,
    from: String,
    to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RequestEthCall {
    jsonrpc: String,
    method: String,
    id: u64,
    params: (RequestEthCallParams, String),
}

#[derive(Deserialize, Debug, Clone)]
struct ResponseEthCallError {
    message: String,
    code: i32,
}

#[derive(Deserialize, Debug, Clone)]
struct ResponseEthCall {
    jsonrpc: String,
    id: Option<FeedId>,
    error: Option<ResponseEthCallError>,
    result: Option<String>,
    #[serde(default)]
    rpc_url: Option<String>,
}

impl RequestEthCall {
    pub fn latest(calldata: &Bytes, contract_address: &Address) -> RequestEthCall {
        let params = RequestEthCallParams {
            data: calldata.0.encode_hex_upper_with_prefix(),
            from: "0x0000000000000000000000000000000000000000".to_string(),
            to: contract_address.to_string(),
        };

        RequestEthCall {
            jsonrpc: "2.0".to_string(),
            method: "eth_call".to_string(),
            id: 1,
            params: (params, "latest".to_string()),
        }
    }
}

// ---------- Config we accept from Settings ----------
#[derive(Serialize, Deserialize, Debug, Clone)]
struct PairDescription {
    base: String,
    quote: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct OracleArgs {
    marketplace: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct FeedConfig {
    #[serde(default)]
    feed_id: FeedId,
    pair: PairDescription,
    #[serde(default)]
    decimals: u32,
    #[serde(default)]
    category: String,
    #[serde(default)]
    market_hours: String,
    arguments: OracleArgs,
}

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
// ---------- Local fetch/processing ----------

fn get_resources_from_settings(settings: &Settings) -> Result<Vec<FeedConfig>> {
    let mut config: Vec<FeedConfig> = Vec::new();
    for feed_setting in &settings.data_feeds {
        match serde_json::from_str::<FeedConfig>(&feed_setting.data) {
            Ok(mut feed_config) => {
                feed_config.feed_id = feed_setting.id.parse::<FeedId>()?;
                config.push(feed_config);
            }
            Err(err) => {
                println!(
                    "Error {err} when parsing feed settings data = '{}'",
                    &feed_setting.data
                );
            }
        }
    }
    Ok(config)
}

#[derive(Debug, Clone)]
struct ReserveInfo {
    underlying_asset: Address,
    variable_borrow_rate: f64,
}

async fn get_borrow_rates(marketplace: &str) -> Result<HashMap<String, ReserveInfo>> {
    let rpc_url = Url::parse("https://rpc.hyperliquid.xyz/evm")?;

    // You don't actually need the provider to build calldata, but keeping it is fine
    let provider = ProviderBuilder::new().connect_http(rpc_url.clone());

    // Based on the marketplace we determine the contract address and the call to make
    let calldata = match marketplace {
        "HypurrFi" => UiPoolDataProvider::new(HYPURRFI_UI_POOL_DATA_PROVIDER, provider)
            .getReservesData(HYPURRFI_POOL_ADDRESSES_PROVIDER)
            .calldata()
            .clone(),
        _ => anyhow::bail!("Unsupported marketplace: {}", marketplace),
    };

    // Build a proper JSON-RPC 2.0 request (must include `id`)
    let req = RequestEthCall::latest(&calldata, &HYPURRFI_UI_POOL_DATA_PROVIDER);

    let resp = http_post_json::<RequestEthCall, ResponseEthCall>(rpc_url.as_str(), req).await?;

    if let Some(err) = resp.error {
        anyhow::bail!("eth_call returned rpc error {}: {}", err.code, err.message);
    }

    let res_hex = resp.result.as_deref().unwrap();

    // Decode ABI-encoded return bytes (strip optional 0x)
    let bytes = Bytes::from(decode(res_hex.trim_start_matches("0x"))?);

    // Decode using the generated SolCall type
    let reserves =
        <UiPoolDataProvider::getReservesDataCall as SolCall>::abi_decode_returns(&bytes)?;

    let mut out: HashMap<String, ReserveInfo> = HashMap::new();

    for r in reserves._0 {
        let rate_ray: f64 = r.variableBorrowRate.to_string().parse().unwrap_or(0.0);
        let apr = rate_ray / RAY_F64;

        out.insert(
            r.symbol.clone(),
            ReserveInfo {
                underlying_asset: r.underlyingAsset,
                variable_borrow_rate: apr,
            },
        );
    }

    Ok(out)
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    let feeds = get_resources_from_settings(&settings)?;
    let mut out = Payload::new();

    println!("Feeds: {:?}", feeds);

    let hypeurrfi_borrow_rates = get_borrow_rates("HypurrFi").await?;
    println!("Reserves: {:?}", hypeurrfi_borrow_rates);

    for (feed) in &feeds {
        // Check which if the marketplace in the feed.arguments.marketplace
        // and get data from the corresponding provider

        if let Some(reserve_info) = match feed.arguments.marketplace.as_str() {
            "HypurrFi" => hypeurrfi_borrow_rates.get(&feed.pair.base),
            _ => None,
        } {
            out.values.push(DataFeedResult {
                id: feed.feed_id.to_string(),
                value: DataFeedResultValue::Numerical(reserve_info.variable_borrow_rate),
            });
        } else {
            out.values.push(DataFeedResult {
                id: feed.feed_id.to_string(),
                value: DataFeedResultValue::Error("No data".to_string()),
            });
        }
    }
    println!("Payload: {:?}", out);

    Ok(out)
}
