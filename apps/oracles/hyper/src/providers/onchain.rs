use alloy::primitives::{Address, Bytes, U256};
use anyhow::Result;

use blocksense_sdk::rpc::eth_call;

use crate::{
    domain::{Rates, ReserveInfo},
    utils::math::ray_to_apr,
};

#[derive(Debug, Clone)]
pub struct ReserveLike {
    pub symbol: String,
    pub underlying: Address,
    pub variable_borrow_rate_ray: U256,
}

pub struct OnchainPlan {
    pub to: Address,
    pub calldata: Bytes,
    pub decode: fn(&Bytes) -> Result<Vec<ReserveLike>>,
}

pub async fn fetch_reserves(rpc_url: &str, plan: OnchainPlan) -> Result<Rates> {
    let raw = eth_call(rpc_url, &format!("{:?}", plan.to), &plan.calldata)
        .await
        .map_err(|e| anyhow::Error::msg(format!("{:?}", e)))?;
    let reserves = (plan.decode)(&raw)?;
    let mut out = Rates::with_capacity(reserves.len());
    for r in reserves {
        let apr = ray_to_apr(r.variable_borrow_rate_ray);
        out.insert(
            r.symbol,
            ReserveInfo {
                underlying_asset: Some(r.underlying),
                borrow_rate: apr,
            },
        );
    }
    Ok(out)
}

pub type MyProvider = alloy::providers::fillers::FillProvider<
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
