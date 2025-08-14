mod domain;
mod utils;

use alloy::sol_types::SolCall;
use alloy::{
    hex::decode,
    hex::ToHexExt,
    primitives::{address, Address, Bytes, U256},
    providers::ProviderBuilder,
};
use anyhow::{anyhow, Result};
use blocksense_data_providers_sdk::price_data::fetchers::money_markets::hyperdrive::{
    self, fetch_rates_for_market,
};
use blocksense_data_providers_sdk::price_data::types::PricePair;
use blocksense_sdk::{
    http::http_post_json,
    oracle::{DataFeedResult, DataFeedResultValue, Payload, Settings},
    oracle_component,
};
use futures::{stream, stream::FuturesUnordered, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::time::Instant;
use url::Url;

use crate::domain::{
    get_resources_from_settings, FeedConfig, FeedId, Marketplace, Rates, ReserveInfo,
};
use crate::utils::logging::{print_marketplace_data, print_payload};
use crate::utils::math::ray_to_apr;

pub mod hypurrfi {
    alloy::sol! {
        #[allow(missing_docs)]
        #[allow(clippy::too_many_arguments)]
        #[sol(rpc)]
        HypurrFiUiPoolDataProvider,
        "src/abi/HypurrFi/UiPoolDataProvider.json"
    }
}

pub mod hyperlend {
    alloy::sol! {
        #[allow(missing_docs)]
        #[allow(clippy::too_many_arguments)]
        #[sol(rpc)]
        HyperLandUiPoolDataProvider,
        "src/abi/HyperLand/UiPoolDataProvider.json"
    }
}

const HYPURRFI_UI_POOL_DATA_PROVIDER: Address =
    address!("0x7b883191011AEAe40581d3Fa1B112413808C9c00");
const HYPURRFI_POOL_ADDRESSES_PROVIDER: Address =
    address!("0xA73ff12D177D8F1Ec938c3ba0e87D33524dD5594");
const HYPERLAND_UI_POOL_DATA_PROVIDER: Address =
    address!("0x3Bb92CF81E38484183cc96a4Fb8fBd2d73535807");
const HYPERLAND_POOL_ADDRESSES_PROVIDER: Address =
    address!("0x72c98246a98bFe64022a3190e7710E157497170C");

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
    pub fn latest(calldata: &Bytes, contract_address: &Address, id: u64) -> RequestEthCall {
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

// ---------- Local fetch/processing ----------

// Internal normalized view (only what we need)
#[derive(Debug, Clone)]
struct ReserveLike {
    symbol: String,
    underlying_asset: Address,
    variable_borrow_rate_ray: U256,
}

type Decoder = fn(&Bytes) -> Result<Vec<ReserveLike>>;

impl TryFrom<&str> for Marketplace {
    type Error = anyhow::Error;
    fn try_from(s: &str) -> Result<Self> {
        match s {
            "HypurrFi" => Ok(Marketplace::HypurrFi),
            "HyperLend" => Ok(Marketplace::HyperLend),
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
            variable_borrow_rate_ray: U256::from(r.variableBorrowRate), // ensure U256
        })
        .collect())
}

fn decode_hyperland(bytes: &Bytes) -> Result<Vec<ReserveLike>> {
    let ret =
        crate::hyperlend::HyperLandUiPoolDataProvider::getReservesDataCall::abi_decode_returns(
            bytes,
        )?;
    Ok(ret
        ._0
        .into_iter()
        .map(|r| ReserveLike {
            symbol: r.symbol.clone(),
            underlying_asset: r.underlyingAsset,
            variable_borrow_rate_ray: U256::from(r.variableBorrowRate), // ensure U256
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
        Marketplace::HyperLend => {
            let calldata = crate::hyperlend::HyperLandUiPoolDataProvider::new(
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

pub async fn get_borrow_rates_from_hyperdrive(feeds_config: &Vec<FeedConfig>) -> Result<Rates> {
    let mut borrow_rates: Rates = HashMap::new();

    // Collect only HyperDrive feeds, grouped by market_id, but store minimal info
    // (avoid capturing &FeedConfig across async boundaries).
    // Vec<(base_symbol, feed_id)>
    let mut by_market: BTreeMap<String, Vec<(String, String)>> = BTreeMap::new();
    for feed in feeds_config
        .iter()
        .filter(|f| f.arguments.marketplace == "HyperDrive")
    {
        match &feed.arguments.market_id {
            Some(mid) if !mid.is_empty() => {
                by_market
                    .entry(mid.clone())
                    .or_default()
                    .push((feed.pair.base.clone(), feed.feed_id.to_string()));
            }
            _ => {
                eprintln!(
                    "Feed {} missing required HyperDrive market_id. Skipping.",
                    feed.feed_id
                );
            }
        }
    }

    // Build a stream of async fetches and run them with bounded concurrency.
    let fetches = by_market
        .into_iter()
        .map(|(market_id, feeds)| async move {
            // Fetch with error boundary; do not fail the whole oracle
            match hyperdrive::fetch_rates_for_market(&market_id).await {
                Ok(resp) => Some((market_id, feeds, resp)),
                Err(err) => {
                    eprintln!(
                        "HyperDrive fetch failed for market_id={}: {}. Skipping feeds referencing this market.",
                        market_id, err
                    );
                    None
                }
            }
        });

    const MAX_CONCURRENCY: usize = 32;
    let mut stream = stream::iter(fetches).buffer_unordered(MAX_CONCURRENCY);

    while let Some(result) = stream.next().await {
        let Some((market_id, feeds, resp)) = result else {
            continue;
        };

        if resp.data.is_empty() {
            eprintln!(
                "HyperDrive returned empty data for market_id={}. Skipping.",
                market_id
            );
            continue;
        }

        // If multiple rows are possible, pick the first/newest per API contract.
        let row = &resp.data[0];

        // Assuming borrow_rate is 1e18-scaled; convert to f64 APR.
        // Avoid integer division by using f64 scaling.
        let borrow_rate_apr: f64 = (row.borrow_rate as f64) / 1e18f64;

        for (base_symbol, _feed_id) in feeds {
            borrow_rates.insert(
                base_symbol,
                ReserveInfo {
                    underlying_asset: None,
                    borrow_rate: borrow_rate_apr,
                },
            );
        }
    }

    Ok(borrow_rates)
}

pub async fn get_borrow_rates_from_chain(marketplace: &str) -> Result<Rates> {
    let rpc_url = Url::parse("https://rpc.hyperliquid.xyz/evm")?;
    let provider = ProviderBuilder::new().connect_http(rpc_url.clone());

    // 1) Normalize marketplace and build the plan
    let mkt = Marketplace::try_from(marketplace)?;
    let plan = build_call_plan(mkt, provider);

    // 2) JSON-RPC call (use the correct "to" per marketplace)
    let req = RequestEthCall::latest(&plan.calldata, &plan.to, 1);
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
        let apr = ray_to_apr(r.variable_borrow_rate_ray);

        out.insert(
            r.symbol,
            ReserveInfo {
                underlying_asset: Some(r.underlying_asset),
                borrow_rate: apr,
            },
        );
    }

    Ok(out)
}

async fn fetch_market<'a>(
    which: &'static str,
    feeds_config: &'a Vec<FeedConfig>,
) -> (&'static str, Result<Rates>) {
    match which {
        "HypurrFi" => ("HypurrFi", get_borrow_rates_from_chain("HypurrFi").await),
        "HyperLend" => ("HyperLend", get_borrow_rates_from_chain("HyperLend").await),
        "HyperDrive" => (
            "HyperDrive",
            get_borrow_rates_from_hyperdrive(feeds_config).await,
        ),
        _ => unreachable!(),
    }
}

pub async fn get_borrow_rates_for_marketplace(
    feeds_config: &Vec<FeedConfig>,
) -> Result<HashMap<String, Rates>> {
    let mut marketplace_borrow_rates: HashMap<String, Rates> = HashMap::new();

    let mut futs = FuturesUnordered::new();
    futs.push(fetch_market("HypurrFi", feeds_config));
    futs.push(fetch_market("HyperLend", feeds_config));
    futs.push(fetch_market("HyperDrive", feeds_config));

    while let Some((name, res)) = futs.next().await {
        match res {
            Ok(rates) => {
                marketplace_borrow_rates.insert(name.to_string(), rates);
            }
            Err(err) => eprintln!("{} fetch failed: {}", name, err),
        }
    }

    print_marketplace_data(&marketplace_borrow_rates);
    Ok(marketplace_borrow_rates)
}

#[oracle_component]
async fn oracle_request(settings: Settings) -> Result<Payload> {
    let feeds_config = get_resources_from_settings(&settings)?;
    let mut payload = Payload::new();
    // Fetch borrow rates for each marketplace and store in a HashMap
    let before_fetch = Instant::now();

    let marketplace_borrow_rates = get_borrow_rates_for_marketplace(&feeds_config).await?;
    let time_taken = before_fetch.elapsed();
    println!(
        "Fetched borrow rates for {} feeds in {:?}",
        feeds_config.len(),
        time_taken
    );

    for feed in &feeds_config {
        let rate_info = marketplace_borrow_rates
            .get(feed.arguments.marketplace.as_str())
            .and_then(|rates| rates.get(&feed.pair.base));

        let value = match rate_info {
            Some(info) => DataFeedResultValue::Numerical(info.borrow_rate),
            None => DataFeedResultValue::Error(format!(
                "No data for {} in {}",
                feed.pair.base, feed.arguments.marketplace
            )),
        };

        payload.values.push(DataFeedResult {
            id: feed.feed_id.to_string(),
            value,
        });
    }

    print_payload(&payload, &feeds_config);
    Ok(payload)
}
