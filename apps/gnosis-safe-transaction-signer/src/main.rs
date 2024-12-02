use alloy::{
    network::EthereumWallet,
    primitives::{address, bytes, keccak256, Address, Bytes, PrimitiveSignature, B256, U256},
    providers::{Provider, ProviderBuilder},
    signers::{local::PrivateKeySigner, Signer},
    sol,
    sol_types::SolStruct,
};
use eyre::Result;

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
    "abi/safe_abi.json"
}

struct SignatureWithAddress {
    signature: PrimitiveSignature,
    signer_address: Address,
}

#[tokio::main]
async fn main() -> Result<()> {
    let private_keys = [
        "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        "5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
        "7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
        "47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
        "8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
        "92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
    ];

    let owners: Vec<PrivateKeySigner> = private_keys
        .iter()
        .map(|&key| create_private_key_signer(key))
        .collect();

    let wallet = EthereumWallet::from(owners[0].clone());

    let provider = ProviderBuilder::new()
        .with_recommended_fillers()
        .wallet(&wallet)
        .on_http("http://127.0.0.1:8545".parse().unwrap());

    let safe_address = address!("Cab0DF91Cda16b675c948b03c1B633BC0eb73101");
    let contract = SafeMultisig::new(safe_address, &provider);

    let nonce = contract.nonce().call().await?;

    let safe_transaction = SafeTx {
        to: address!("e7f1725E7734CE288F8367e1Bb143E90bb3F0512"),
        value: U256::from(0),
        data: bytes!(
            "1a2d80ac0000000048656c6c6f2c20576f726c642120300000000000000000000000000000000000"
        ),
        operation: 0,
        safeTxGas: U256::from(0),
        gasPrice: U256::from(0),
        baseGas: U256::from(0),
        gasToken: address!("0000000000000000000000000000000000000000"),
        refundReceiver: address!("0000000000000000000000000000000000000000"),
        nonce: nonce._0,
    };

    let chain_id = provider.get_chain_id().await?;

    let tx_hash =
        generate_transaction_hash(safe_address, U256::from(chain_id), safe_transaction.clone());

    let mut signatures_with_addresses = Vec::new();

    for owner in &owners {
        let signature = owner.sign_hash(&tx_hash).await?;
        let signer_address = owner.address();
        signatures_with_addresses.push(SignatureWithAddress {
            signature,
            signer_address,
        });

        // Verify message recovery
        let recovered_address = signature.recover_address_from_prehash(&tx_hash).unwrap();
        assert_eq!(signer_address, recovered_address);
    }

    // Gnosis safe requires signatures to be sorted by signer address
    signatures_with_addresses.sort_by(|a, b| a.signer_address.cmp(&b.signer_address));

    let signature_bytes: Vec<u8> = signatures_with_addresses
        .into_iter()
        .flat_map(|entry| signature_to_bytes(entry.signature))
        .collect();

    let transaction = contract
        .execTransaction(
            safe_transaction.to,
            safe_transaction.value,
            safe_transaction.data,
            safe_transaction.operation,
            safe_transaction.safeTxGas,
            safe_transaction.baseGas,
            safe_transaction.gasPrice,
            safe_transaction.gasToken,
            safe_transaction.refundReceiver,
            Bytes::copy_from_slice(&signature_bytes),
        )
        .send()
        .await?
        .watch()
        .await?;

    println!("Transaction hash: {:?}", transaction);

    Ok(())
}

fn generate_transaction_hash(safe_address: Address, chain_id: U256, data: SafeTx) -> B256 {
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

fn signature_to_bytes(signature: PrimitiveSignature) -> Vec<u8> {
    let v = if signature.v() { 28 } else { 27 };
    let r_bytes: [u8; 32] = signature.r().to_be_bytes();
    let s_bytes: [u8; 32] = signature.s().to_be_bytes();
    let mut signature_bytes = Vec::with_capacity(65);
    signature_bytes.extend_from_slice(&r_bytes);
    signature_bytes.extend_from_slice(&s_bytes);
    signature_bytes.push(v);

    signature_bytes
}

fn create_private_key_signer(private_key: &str) -> PrivateKeySigner {
    PrivateKeySigner::from_bytes(&B256::new(
        hex::decode(private_key).unwrap().try_into().unwrap(),
    ))
    .unwrap()
}
