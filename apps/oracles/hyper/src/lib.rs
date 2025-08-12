use alloy::sol_types::SolCall;
use alloy::{
    hex::ToHexExt,
    hex::{decode, encode},
    primitives::{address, Address, Bytes, U256},
    providers::ProviderBuilder,
    sol,
};
use anyhow::{anyhow, Result};
use blocksense_sdk::{
    http::http_post_json,
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};
use itertools::Itertools;
use prettytable::{format, Cell, Row, Table};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use url::Url;

pub mod hypurrfi {
    alloy::sol! {
        #[allow(missing_docs)]
        #[allow(clippy::too_many_arguments)]
        #[sol(rpc)]
        HypurrFiUiPoolDataProvider,
        "src/abi/HypurrFiUI.json"
    }
}

pub mod hyperland {
    alloy::sol! {
        #[allow(missing_docs)]
        #[allow(clippy::too_many_arguments)]
        #[sol(rpc)]
        HyperLandUiPoolDataProvider,
        "src/abi/HyperLandUI.json"
    }
}

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
pub struct ReserveInfo {
    underlying_asset: Address,
    variable_borrow_rate: f64,
}

// Internal normalized view (only what we need)
#[derive(Debug, Clone)]
struct ReserveLike {
    symbol: String,
    underlying_asset: Address,
    variable_borrow_rate_ray: u128,
}

type Decoder = fn(&Bytes) -> Result<Vec<ReserveLike>>;

enum Marketplace {
    HypurrFi,
    HyperLand,
}

impl TryFrom<&str> for Marketplace {
    type Error = anyhow::Error;
    fn try_from(s: &str) -> Result<Self> {
        match s {
            "HypurrFi" => Ok(Marketplace::HypurrFi),
            "HyperLand" => Ok(Marketplace::HyperLand),
            other => Err(anyhow!("Unsupported marketplace: {}", other)),
        }
    }
}

struct CallPlan {
    to: Address,
    calldata: Bytes,
    decode: Decoder,
}

// --- Concrete decoders ---

fn decode_hypurrfi(bytes: &Bytes) -> Result<Vec<ReserveLike>> {
    let ret = crate::hypurrfi::HypurrFiUiPoolDataProvider::getReservesDataCall::abi_decode_returns(
        bytes,
    )?;
    Ok(ret
        ._0
        .into_iter()
        .map(|r| ReserveLike {
            symbol: r.symbol,
            underlying_asset: r.underlyingAsset,
            variable_borrow_rate_ray: r.variableBorrowRate,
        })
        .collect())
}

fn decode_hyperland(bytes: &Bytes) -> Result<Vec<ReserveLike>> {
    let ret =
        crate::hyperland::HyperLandUiPoolDataProvider::getReservesDataCall::abi_decode_returns(
            bytes,
        )?;
    Ok(ret
        ._0
        .into_iter()
        .map(|r| ReserveLike {
            symbol: r.symbol.clone(),
            underlying_asset: r.underlyingAsset,
            variable_borrow_rate_ray: r.variableBorrowRate,
        })
        .collect())
}

// --- Planner ---

fn build_call_plan(
    marketplace: Marketplace,
    provider: MyProvider, // whatever your concrete type is
) -> CallPlan {
    match marketplace {
        Marketplace::HypurrFi => {
            let calldata = crate::hypurrfi::HypurrFiUiPoolDataProvider::new(
                HYPURRFI_UI_POOL_DATA_PROVIDER,
                provider,
            )
            .getReservesData(HYPURRFI_POOL_ADDRESSES_PROVIDER)
            .calldata()
            .clone();

            CallPlan {
                to: HYPURRFI_UI_POOL_DATA_PROVIDER,
                calldata,
                decode: decode_hypurrfi,
            }
        }
        Marketplace::HyperLand => {
            let calldata = crate::hyperland::HyperLandUiPoolDataProvider::new(
                HYPERLAND_UI_POOL_DATA_PROVIDER,
                provider,
            )
            .getReservesData(HYPERLAND_POOL_ADDRESSES_PROVIDER)
            .calldata()
            .clone();

            CallPlan {
                to: HYPERLAND_UI_POOL_DATA_PROVIDER,
                calldata,
                decode: decode_hyperland,
            }
        }
    }
}

// --- Main function ---

pub async fn get_borrow_rates(marketplace: &str) -> Result<HashMap<String, ReserveInfo>> {
    let rpc_url = Url::parse("https://rpc.hyperliquid.xyz/evm")?;
    let provider = ProviderBuilder::new().connect_http(rpc_url.clone());

    // 1) Normalize marketplace and build the plan
    let mkt = Marketplace::try_from(marketplace)?;
    let plan = build_call_plan(mkt, provider);

    // 2) JSON-RPC call (use the correct "to" per marketplace)
    let req = RequestEthCall::latest(&plan.calldata, &plan.to);
    let resp = http_post_json::<RequestEthCall, ResponseEthCall>(rpc_url.as_str(), req).await?;
    if let Some(err) = resp.error {
        return Err(anyhow!(
            "eth_call returned rpc error {}: {}",
            err.code,
            err.message
        ));
    }

    // 3) Decode bytes
    let res_hex = resp
        .result
        .as_deref()
        .ok_or_else(|| anyhow!("empty eth_call result"))?;
    let bytes = Bytes::from(decode(res_hex.trim_start_matches("0x"))?);

    // 4) Marketplace-specific ABI decode -> normalized Vec<ReserveLike>
    let reserves_like = (plan.decode)(&bytes)?;

    // 5) Normalize rates and assemble output
    let mut out = HashMap::with_capacity(reserves_like.len());
    for r in reserves_like {
        // Convert RAY to APR f64
        let rate_ray_f64: f64 = r
            .variable_borrow_rate_ray
            .to_string()
            .parse()
            .unwrap_or(0.0);
        let apr = rate_ray_f64 / RAY_F64;

        out.insert(
            r.symbol,
            ReserveInfo {
                underlying_asset: r.underlying_asset,
                variable_borrow_rate: apr,
            },
        );
    }

    Ok(out)
}

type MarketplaceBorrowRates = HashMap<String, HashMap<String, ReserveInfo>>;

pub async fn get_borrow_rates_for_marketplace() -> Result<MarketplaceBorrowRates> {
    let mut marketplace_borrow_rates: MarketplaceBorrowRates = HashMap::new();

    // Fetch for all known marketplaces
    let hypurrfi_rates = get_borrow_rates("HypurrFi").await?;
    marketplace_borrow_rates.insert("HypurrFi".to_string(), hypurrfi_rates);

    let hyperland_rates = get_borrow_rates("HyperLand").await?;
    marketplace_borrow_rates.insert("HyperLand".to_string(), hyperland_rates);

    print_marketplace_data(&marketplace_borrow_rates);
    Ok(marketplace_borrow_rates)
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    let feeds = get_resources_from_settings(&settings)?;
    let mut payload = Payload::new();
    // Fetch borrow rates for each marketplace and store in a HashMap
    let marketplace_borrow_rates = get_borrow_rates_for_marketplace().await?;
    for (feed) in &feeds {
        // Check which if the marketplace in the feed.arguments.marketplace
        // and get data from the corresponding provider

        if let Some(reserve_info) = match feed.arguments.marketplace.as_str() {
            "HypurrFi" => marketplace_borrow_rates
                .get("HypurrFi")
                .unwrap()
                .get(&feed.pair.base),
            "HyperLand" => marketplace_borrow_rates
                .get("HyperLand")
                .unwrap()
                .get(&feed.pair.base),
            _ => None,
        } {
            payload.values.push(DataFeedResult {
                id: feed.feed_id.to_string(),
                value: DataFeedResultValue::Numerical(reserve_info.variable_borrow_rate),
            });
        } else {
            payload.values.push(DataFeedResult {
                id: feed.feed_id.to_string(),
                value: DataFeedResultValue::Error("No data".to_string()),
            });
        }
    }
    print_payload(&payload, &feeds);
    Ok(payload)
}

fn print_marketplace_data(marketplace_borrow_rates: &MarketplaceBorrowRates) {
    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);
    table.set_titles(Row::new(vec![
        Cell::new("Marketplace"),
        Cell::new("Symbol"),
        Cell::new("Underlying Asset"),
        Cell::new("Variable Borrow Rate (APR)"),
    ]));

    for (marketplace, borrow_rates) in marketplace_borrow_rates {
        for (symbol, info) in borrow_rates {
            table.add_row(Row::new(vec![
                Cell::new(marketplace),
                Cell::new(symbol),
                Cell::new(&info.underlying_asset.to_string()),
                Cell::new(&format!("{:.2}%", info.variable_borrow_rate * 100.0)),
            ]));
        }
    }

    table.printstd();
}

fn print_payload(payload: &Payload, resources: &[FeedConfig]) {
    //Sort feeds from resources based on feed_id
    let sorted_feeds: Vec<&FeedConfig> = resources
        .iter()
        .sorted_by_key(|feed| feed.feed_id)
        .collect();

    let mut table = Table::new();
    table.set_format(*format::consts::FORMAT_NO_LINESEP_WITH_TITLE);
    table.set_titles(Row::new(vec![
        Cell::new("Feed ID"),
        Cell::new("Feed Name"),
        Cell::new("Value"),
    ]));

    for feed in sorted_feeds {
        let value = payload
            .values
            .iter()
            .find(|v| v.id == feed.feed_id.to_string());
        let display_value = match value {
            Some(v) => format!("{:?}", v.value),
            None => "No Data".to_string(),
        };

        table.add_row(Row::new(vec![
            Cell::new(feed.feed_id.to_string().as_str()),
            Cell::new(&feed.pair.base),
            Cell::new(&display_value),
        ]));
    }

    table.printstd();
}
