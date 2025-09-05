use alloy::primitives::{address, Address, Bytes, U256};
use alloy::sol_types::SolCall;
use anyhow::Result;

use crate::providers::pool_data_provider::{ReserveLike, UiPool};
use crate::providers::types::MyProvider;

pub const HYPERLAND_UI_POOL_DATA_PROVIDER: Address =
    address!("0x3Bb92CF81E38484183cc96a4Fb8fBd2d73535807");
pub const HYPERLAND_POOL_ADDRESSES_PROVIDER: Address =
    address!("0x72c98246a98bFe64022a3190e7710E157497170C");

pub mod hyperlend {
    alloy::sol! {
        #[allow(missing_docs)]
        #[allow(clippy::too_many_arguments)]
        #[sol(rpc)]
        HyperLandUiPoolDataProvider,
        "src/abi/HyperLand/UiPoolDataProvider.json"
    }
}

pub struct HyperLendUi;

impl UiPool for HyperLendUi {
    fn calldata(provider: MyProvider, ui: Address, addresses_provider: Address) -> Bytes {
        let instance = hyperlend::HyperLandUiPoolDataProvider::new(ui, provider);
        instance
            .getReservesData(addresses_provider)
            .calldata()
            .clone()
    }

    fn decode(raw: &Bytes) -> Result<Vec<ReserveLike>> {
        // Adjust the path if your generator differs:
        let ret =
            hyperlend::HyperLandUiPoolDataProvider::getReservesDataCall::abi_decode_returns(raw)?;

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
