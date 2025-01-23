use alloy::{sol, sol_types::SolStruct};
use alloy_primitives::{keccak256, Address, B256, U256};

sol! {
    #[derive(Debug)]
    struct SafeTx {
        address to;
        uint256 value;
        bytes data;
        uint8 operation;
        uint256 safeTxGas;
        uint256 baseGas;
        uint256 gasPrice;
        address gasToken;
        address refundReceiver;
        uint256 nonce;
    }

    struct EIP712Domain {
        uint256 chainId;
        address verifyingContract;
    }
}

sol! {
    #[allow(clippy::too_many_arguments)]
    #[sol(rpc)]
    SafeMultisig,
    "safe_abi.json"
}

pub fn generate_transaction_hash(safe_address: Address, chain_id: U256, data: SafeTx) -> B256 {
    let mut parts = Vec::new();

    parts.extend(hex::decode("1901").unwrap());

    let domain = EIP712Domain {
        chainId: chain_id,
        verifyingContract: safe_address,
    };

    parts.extend(domain.eip712_hash_struct());

    let type_hash = data.eip712_type_hash().0.to_vec();
    let struct_data = data.eip712_encode_data();
    let encoded_data = [type_hash, struct_data].concat();

    let safe_tx_data_hash = keccak256(encoded_data);

    parts.extend(safe_tx_data_hash);

    keccak256(parts)
}
