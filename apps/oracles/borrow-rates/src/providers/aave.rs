use alloy::primitives::{address, Address, Bytes, U256};
use alloy::sol_types::SolCall;
use anyhow::Result;

use crate::providers::onchain::{MyProvider, ReserveLike, UiPool};

pub const AAVE_UI_POOL_DATA_PROVIDER: Address =
    address!("0x3F78BBD206e4D3c504Eb854232EdA7e47E9Fd8FC");
pub const AAVE_POOL_ADDRESSES_PROVIDER: Address =
    address!("0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e");

pub mod aave {
    alloy::sol! {
        #[allow(missing_docs)]
        #[allow(clippy::too_many_arguments)]
        #[sol(rpc)]
        AaveFiUiPoolDataProvider,
        "src/abi/Aave/UiPoolDataProvider.json"
    }
}

pub struct AaveUi;

impl UiPool for AaveUi {
    fn calldata(provider: MyProvider, ui: Address, addresses_provider: Address) -> Bytes {
        let instance = aave::AaveFiUiPoolDataProvider::new(ui, provider);
        instance
            .getReservesData(addresses_provider)
            .calldata()
            .clone()
    }

    fn decode(raw: &Bytes) -> Result<Vec<ReserveLike>> {
        // Adjust the path if your generator differs:
        println!("Decoding Aave raw data: {:?}", raw);
        let ret = aave::AaveFiUiPoolDataProvider::getReservesDataCall::abi_decode_returns(raw)?;

        // Map ABI return -> Vec<ReserveLike>
        let x = ret
            ._0
            .into_iter()
            .map(|r| ReserveLike {
                symbol: r.symbol,
                underlying: r.underlyingAsset,
                variable_borrow_rate_ray: U256::from(r.variableBorrowRate),
            })
            .collect();
        println!("Decoded Aave data: {:?}", x);
        Ok(x)
    }
}
