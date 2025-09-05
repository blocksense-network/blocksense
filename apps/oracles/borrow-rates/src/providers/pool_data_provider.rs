use alloy::{
    primitives::{Address, Bytes, U256},
    providers::ProviderBuilder,
};
use anyhow::Result;

use blocksense_sdk::eth_rpc::eth_call;
use url::Url;

use crate::{
    domain::BorrowRateInfo,
    providers::types::{MyProvider, RPC_URL_HYPERLIQUID_MAINNET},
    utils::math::ray_to_apr,
};

#[derive(Debug, Clone)]
pub struct ReserveLike {
    pub symbol: String,
    pub underlying: Address,
    pub variable_borrow_rate_ray: U256,
}

pub struct Plan {
    pub to: Address,
    pub calldata: Bytes,
    pub decode: fn(&Bytes) -> Result<Vec<ReserveLike>>,
}

pub trait UiPool {
    /// Build calldata for `getReservesData(addresses_provider)`.
    fn calldata(provider: MyProvider, ui: Address, addresses_provider: Address) -> Bytes;

    /// Decode raw return bytes into domain objects.
    fn decode(raw: &Bytes) -> Result<Vec<ReserveLike>>;
}

/// One generic constructor used everywhere.
pub fn plan_for<P: UiPool>(ui: Address, addresses_provider: Address) -> Result<Plan> {
    let rpc_url = Url::parse(RPC_URL_HYPERLIQUID_MAINNET)?;
    let provider = ProviderBuilder::new().connect_http(rpc_url.clone());
    let calldata = P::calldata(provider, ui, addresses_provider);
    Ok(Plan {
        to: ui,
        calldata,
        decode: |b| P::decode(b),
    })
}

pub async fn fetch_reserves(plan: Plan) -> Result<Vec<BorrowRateInfo>> {
    let raw = eth_call(
        RPC_URL_HYPERLIQUID_MAINNET,
        &format!("{:?}", plan.to),
        &plan.calldata,
    )
    .await
    .map_err(|e| anyhow::Error::msg(format!("{:?}", e)))?;
    let reserves = (plan.decode)(&raw)?;
    let mut out = Vec::with_capacity(reserves.len());
    for r in reserves {
        let apr = ray_to_apr(r.variable_borrow_rate_ray);
        out.push(BorrowRateInfo {
            asset: r.symbol,
            underlying_asset: Some(r.underlying),
            borrow_rate: apr,
        });
    }
    Ok(out)
}
