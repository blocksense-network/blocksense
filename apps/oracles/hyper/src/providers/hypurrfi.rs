use alloy::primitives::{Address, Bytes, U256};
use alloy::sol_types::SolCall;
use anyhow::Result;

use crate::providers::onchain::{MyProvider, OnchainPlan, ReserveLike};

pub mod hypurrfi {
    alloy::sol! {
        #[allow(missing_docs)]
        #[allow(clippy::too_many_arguments)]
        #[sol(rpc)]
        HypurrFiUiPoolDataProvider,
        "src/abi/HypurrFi/UiPoolDataProvider.json"
    }
}

pub fn plan(provider: MyProvider, ui: Address, addresses_provider: Address) -> OnchainPlan {
    // If your generated call types need an instance with a provider to produce calldata,
    // create it here. Otherwise, directly ABI encode a call struct (preferred).
    let instance = crate::hypurrfi::HypurrFiUiPoolDataProvider::new(ui, provider);
    let calldata = instance
        .getReservesData(addresses_provider)
        .calldata()
        .clone();

    OnchainPlan {
        to: ui,
        calldata,
        decode: decode_hypurrfi,
    }
}

fn decode_hypurrfi(bytes: &Bytes) -> Result<Vec<ReserveLike>> {
    let ret = crate::hypurrfi::HypurrFiUiPoolDataProvider::getReservesDataCall::abi_decode_returns(
        bytes,
    )?;
    Ok(ret
        ._0
        .into_iter()
        .map(|r| ReserveLike {
            symbol: r.symbol,
            underlying: r.underlyingAsset,
            variable_borrow_rate_ray: U256::from(r.variableBorrowRate),
        })
        .collect())
}
