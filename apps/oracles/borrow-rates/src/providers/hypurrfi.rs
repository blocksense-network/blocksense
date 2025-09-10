use alloy::primitives::{address, Address, Bytes, U256};
use alloy::sol_types::SolCall;
use anyhow::Result;

use crate::providers::pool_data_provider::{ReserveLike, UiPool};
use crate::providers::types::MyProvider;

pub const HYPURRFI_UI_POOL_DATA_PROVIDER: Address =
    address!("0x7b883191011AEAe40581d3Fa1B112413808C9c00");
pub const HYPURRFI_POOL_ADDRESSES_PROVIDER: Address =
    address!("0xA73ff12D177D8F1Ec938c3ba0e87D33524dD5594");

pub mod hypurrfi {
    alloy::sol! {
        #[allow(missing_docs)]
        #[allow(clippy::too_many_arguments)]
        #[sol(rpc)]
        HypurrFiUiPoolDataProvider,
        "src/abi/HypurrFi/UiPoolDataProvider.json"
    }
}

pub struct HypurrFiUi;

impl UiPool for HypurrFiUi {
    const UI_POOL_DATA_PROVIDER: Address = HYPURRFI_UI_POOL_DATA_PROVIDER;
    const POOL_ADDRESSES_PROVIDER: Address = HYPURRFI_POOL_ADDRESSES_PROVIDER;

    fn calldata(provider: MyProvider) -> Bytes {
        let instance =
            hypurrfi::HypurrFiUiPoolDataProvider::new(Self::UI_POOL_DATA_PROVIDER, provider);
        instance
            .getReservesData(Self::POOL_ADDRESSES_PROVIDER)
            .calldata()
            .clone()
    }

    fn decode(raw: &Bytes) -> Result<Vec<ReserveLike>> {
        // Adjust the path if your generator differs:
        let ret =
            hypurrfi::HypurrFiUiPoolDataProvider::getReservesDataCall::abi_decode_returns(raw)?;

        // Map ABI return -> Vec<ReserveLike>
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
}
