use crate::utils::SafeMultisig::SafeMultisigInstance;
use alloy::providers::{
    fillers::{
        BlobGasFiller, ChainIdFiller, FillProvider, GasFiller, JoinFill, NonceFiller, WalletFiller,
    },
    Identity, RootProvider,
};
use alloy::{
    network::EthereumWallet,
    signers::{local::PrivateKeySigner, Signer},
    sol,
    sol_types::SolStruct,
    transports::http::{Client, Http},
};

use alloy_primitives::{
    address, keccak256, Address, Bytes, FixedBytes, Signature, Uint, B256, U256,
};

pub type SafeMultisigInst = SafeMultisigInstance<
    Http<Client>,
    FillProvider<
        JoinFill<
            JoinFill<
                Identity,
                JoinFill<GasFiller, JoinFill<BlobGasFiller, JoinFill<NonceFiller, ChainIdFiller>>>,
            >,
            WalletFiller<EthereumWallet>,
        >,
        RootProvider,
    >,
>;

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

#[derive(Clone, Debug)]
pub struct SignatureWithAddress {
    pub signature: Signature,
    pub signer_address: Address,
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

pub fn create_private_key_signer(private_key: &str) -> PrivateKeySigner {
    PrivateKeySigner::from_bytes(&B256::new(
        hex::decode(private_key).unwrap().try_into().unwrap(),
    ))
    .unwrap()
}

pub fn hex_str_to_bytes32(hex_string: &str) -> anyhow::Result<FixedBytes<32>> {
    let hex_string = hex_string.strip_prefix("0x").unwrap_or(hex_string);
    if hex_string.len() != 64 {
        // Exactly 32 bytes * 2 hex chars/byte = 64
        anyhow::bail!("Hex string must be exactly 64 characters long".to_string());
    }

    let mut bytes = [0u8; 32]; // Initialize the array

    for i in (0..hex_string.len()).step_by(2) {
        let hex_pair = &hex_string[i..i + 2];
        let byte = u8::from_str_radix(hex_pair, 16)?;
        bytes[i / 2] = byte; // Index into the array
    }

    Ok(FixedBytes::<32>::new(bytes))
}

pub async fn sign_hash(
    owner: &PrivateKeySigner,
    tx_hash: &FixedBytes<32>,
) -> anyhow::Result<SignatureWithAddress> {
    let signature = owner.sign_hash(tx_hash).await?;
    let signer_address = owner.address();
    Ok(SignatureWithAddress {
        signature,
        signer_address,
    })
}

// to be called by sequencer on receiving a signature from the reporter in order to verify it is valid
pub fn verify_message_recovery(
    signature: Signature,
    tx_hash: &FixedBytes<32>,
    signer_address: Address,
) {
    let recovered_address = signature.recover_address_from_prehash(tx_hash).unwrap();
    assert_eq!(signer_address, recovered_address);
}

pub fn create_safe_tx(contract_address: Address, calldata: Bytes, nonce: Uint<256, 4>) -> SafeTx {
    SafeTx {
        to: contract_address,
        value: U256::from(0),
        data: calldata,
        operation: 0,
        safeTxGas: U256::from(0),
        gasPrice: U256::from(0),
        baseGas: U256::from(0),
        gasToken: address!("0000000000000000000000000000000000000000"),
        refundReceiver: address!("0000000000000000000000000000000000000000"),
        nonce,
    }
}

pub fn signature_to_bytes(signature: Signature) -> Vec<u8> {
    let v = if signature.v() { 28 } else { 27 };
    let r_bytes: [u8; 32] = signature.r().to_be_bytes();
    let s_bytes: [u8; 32] = signature.s().to_be_bytes();
    let mut signature_bytes = Vec::with_capacity(65);
    signature_bytes.extend_from_slice(&r_bytes);
    signature_bytes.extend_from_slice(&s_bytes);
    signature_bytes.push(v);

    signature_bytes
}

pub fn bytes_to_hex_string(signature: Signature) -> String {
    hex::encode(signature.as_bytes())
}

pub async fn get_signature_bytes(
    signatures_with_addresses: &mut [SignatureWithAddress],
) -> Vec<u8> {
    // Gnosis safe requires signatures to be sorted by signer address
    signatures_with_addresses.sort_by(|a, b| a.signer_address.cmp(&b.signer_address));

    let signature_bytes: Vec<u8> = signatures_with_addresses
        .iter_mut()
        .flat_map(|entry| signature_to_bytes(entry.signature))
        .collect();
    signature_bytes
}
