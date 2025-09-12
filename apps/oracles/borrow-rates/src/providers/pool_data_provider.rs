use alloy::{
    primitives::{Address, Bytes, U256},
    providers::ProviderBuilder,
};
use anyhow::Result;

use blocksense_sdk::eth_rpc::eth_call;

use crate::{
    domain::{BorrowRateInfo, Marketplace, SupportedNetworks},
    providers::{
        aave::AaveUi, hyperlend::HyperLendUi, hypurrfi::HypurrFiUi, types::{get_rpc_url, MyProvider}
    },
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
    const UI_POOL_DATA_PROVIDER: Address;
    const POOL_ADDRESSES_PROVIDER: Address;

    fn calldata(provider: MyProvider) -> Bytes;
    fn decode(raw: &Bytes) -> Result<Vec<ReserveLike>>;
    fn plan_for(network: SupportedNetworks) -> Result<Plan> {
        let rpc_url = get_rpc_url(&network)?;
        let provider = ProviderBuilder::new().connect_http(rpc_url.clone());
        let calldata = Self::calldata(provider);
        Ok(Plan {
            to: Self::UI_POOL_DATA_PROVIDER,
            calldata,
            decode: |b| Self::decode(b),
        })
    }
}

pub async fn fetch_reserves(
    marketplace: Marketplace,
    network: SupportedNetworks,
) -> Result<Vec<BorrowRateInfo>> {
    let plan = match marketplace {
        Marketplace::HypurrFi(_) => HypurrFiUi::plan_for(network)?,
        Marketplace::HyperLend(_) => HyperLendUi::plan_for(network)?,
        Marketplace::Aave(_) => AaveUi::plan_for(network)?,
        Marketplace::HyperDrive(_) | Marketplace::EulerFinance(_) => {
            unreachable!(
                "Pool data provider not supported for this marketplace {:?}",
                marketplace
            );
        }
    };

    let rpc_url_val = get_rpc_url(&network)?;
    let rpc_url = rpc_url_val.as_str();

    let raw = eth_call(rpc_url, &format!("{:?}", plan.to), &plan.calldata)
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
