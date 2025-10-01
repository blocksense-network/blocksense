use std::env;
use std::fs;
use std::sync::Arc;

use alloy::hex::FromHex;
use alloy::network::TransactionBuilder;
use alloy::primitives::{Address, Bytes, TxHash};
use alloy::providers::Provider;
use alloy::rpc::types::TransactionReceipt;
use alloy::rpc::types::TransactionRequest;
use alloy::signers::local::PrivateKeySigner;
use anyhow::{anyhow, Context, Result};
use blocksense_config::{AllFeedsConfig, Provider as ProviderConfig};
use blocksense_data_feeds::feeds_processing::BatchedAggregatesToSend;
use blocksense_metrics::metrics::ProviderMetrics;
use reqwest::Url;
use sequencer::providers::eth_send_utils::get_chain_id;
use sequencer::providers::eth_send_utils::get_nonce;
use sequencer::providers::eth_send_utils::{get_gas_limit, get_tx_retry_params, GasFees};
use sequencer::providers::provider::RpcProvider;
use tokio::sync::RwLock;

const DEFAULT_NETWORK_NAME: &str = "cli-network";
const DEFAULT_TRANSACTION_RETRIES_COUNT_BEFORE_GIVE_UP: u32 = 3;
const DEFAULT_TRANSACTION_RETRY_TIMEOUT_SECS: u32 = 30;
const DEFAULT_RETRY_FEE_INCREMENT_FRACTION: f64 = 0.1;
const DEFAULT_TRANSACTION_GAS_LIMIT: u32 = 300_000;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let args = env::args().skip(1).collect::<Vec<_>>();
    if args.len() < 2 || args.len() > 3 {
        return Err(anyhow!(
            "usage: tx-retry-params <rpc_url> <private_key_path> [transaction_gas_limit]"
        ));
    }

    let rpc_url = args[0].clone();
    let private_key_path = args[1].clone();
    let transaction_gas_limit = if args.len() == 3 {
        args[2].parse::<u32>().with_context(|| {
            format!(
                "failed to parse optional transaction_gas_limit `{}` as u64",
                args[2]
            )
        })?
    } else {
        DEFAULT_TRANSACTION_GAS_LIMIT
    };

    let url = Url::parse(&rpc_url)
        .with_context(|| format!("the provided rpc_url `{rpc_url}` is not a valid URL"))?;

    let private_key = fs::read_to_string(&private_key_path)
        .with_context(|| format!("failed to read private key from `{}`", private_key_path))?;
    let private_key = private_key.trim();

    let signer: PrivateKeySigner = private_key
        .parse()
        .with_context(|| "failed to parse the provided private key")?;

    let provider_config = ProviderConfig {
        private_key_path: private_key_path.clone(),
        url: rpc_url.clone(),
        transaction_retries_count_before_give_up: DEFAULT_TRANSACTION_RETRIES_COUNT_BEFORE_GIVE_UP,
        transaction_retry_timeout_secs: DEFAULT_TRANSACTION_RETRY_TIMEOUT_SECS,
        retry_fee_increment_fraction: DEFAULT_RETRY_FEE_INCREMENT_FRACTION,
        transaction_gas_limit,
        impersonated_anvil_account: None,
        is_enabled: true,
        should_load_round_counters: false,
        should_load_historical_values: false,
        allow_feeds: None,
        publishing_criteria: Vec::new(),
        contracts: Vec::new(),
    };

    let provider_metrics = Arc::new(RwLock::new(ProviderMetrics::new("")?));
    let feeds_config = AllFeedsConfig { feeds: Vec::new() };

    let rpc_provider = RpcProvider::new(
        DEFAULT_NETWORK_NAME,
        url,
        &signer,
        &provider_config,
        &provider_metrics,
        &feeds_config,
    )
    .await;

    let to_address: Address = "0xadf5aadbe080819209bf641fdf03748bb495c6f3"
        .parse()
        .expect("invalid destination address literal");

    let input = Bytes::from_hex(
        "0x0100000000d1b82ab900000001000303400201200000000000000000000000000000000000000000015a2138000001998664b15001010001000000000000000000000000000000000000000200000000000100000000"
    ).expect("Wrong hex data");

    // 4) to, from, data, nonce, chain_id
    {
        let nonce = match get_nonce(
            DEFAULT_NETWORK_NAME,
            &rpc_provider.provider,
            &signer.address(),
            10000, //This is only used for logging
            300,
            false,
        )
        .await
        {
            Ok(n) => n,
            Err(e) => {
                panic!("Could not get nonce! {e}");
            }
        };

        let chain_id = match get_chain_id(
            DEFAULT_NETWORK_NAME,
            &rpc_provider,
            &BatchedAggregatesToSend::default(),
            300,
        )
        .await
        {
            Ok(v) => {
                println!("Successfully got value in network block height for chain_id");
                v
            }
            Err(err) => {
                panic!("get_chain_id error {err} in network ");
            }
        };

        let mut tx_request = TransactionRequest::default()
            .to(to_address)
            .with_nonce(nonce)
            .with_from(signer.address())
            .with_chain_id(chain_id)
            .input(Some(input.clone()).into());

        tx_request.set_input_and_data();

        println!("4) to, from, data, nonce, chain_id: {tx_request:?}");
        let gas_limit = get_gas_limit(
            DEFAULT_NETWORK_NAME,
            &rpc_provider.provider,
            &tx_request,
            provider_config.transaction_retry_timeout_secs as u64,
            provider_config.transaction_gas_limit,
        )
        .await;
        println!("4) Estimated gas limit: {}", gas_limit);

        tx_request.set_gas_limit(gas_limit);

        let gas_fees = get_tx_retry_params(
            DEFAULT_NETWORK_NAME,
            &rpc_provider.provider,
            &provider_metrics,
            &signer.address(),
            100,
            100,
            0.1,
        )
        .await
        .expect("Could not get gas fees");

        match gas_fees {
            GasFees::Legacy(gas_price) => {
                tx_request = tx_request
                    .with_gas_price(gas_price.gas_price)
                    .transaction_type(0);
            }
            GasFees::Eip1559(eip1559_gas_fees) => {
                tx_request = tx_request
                    .with_max_priority_fee_per_gas(eip1559_gas_fees.priority_fee)
                    .with_max_fee_per_gas(eip1559_gas_fees.max_fee_per_gas);
            }
        }

        println!("tx_request = {tx_request:?}");

        // let tx_result = rpc_provider.provider.send_transaction(tx_request).await;
        let tx_hash: TxHash = "0x84ae26d7a64c10d6b9f6708c98d99dde1b41f93ef2b6c62394845456b5db098e"
            .parse()
            .expect("invalid tx hash literal");

        let tx_result: Option<serde_json::Value> = rpc_provider
            .provider.raw_request("eth_getTransactionReceipt".into(), (tx_hash,))
            .await?;

        match get_receipt_with_default_type(tx_result) {
            Ok(Some(receipt)) => {
                println!("4) tx_receipt = {receipt:?}");
            }
            Ok(None) => {
                println!("4) No receipt found for transaction hash: {tx_hash}");
            }
            Err(e) => {
                println!("4) Error parsing receipt: {e:?}");
            }
        }
    }

    Ok(())
}


fn get_receipt_with_default_type(
    receipt_json: Option<serde_json::Value>,
) -> Result<Option<TransactionReceipt>, Box<dyn std::error::Error>> {
    match receipt_json {
        None => Ok(None),
        Some(mut value) => {
            // We expect the receipt to be a JSON object; if it’s not, return an error.
            let obj = value
                .as_object_mut()
                .ok_or_else(|| "receipt JSON is not an object")?;

            // If the "type" key is missing, insert a legacy type ("0x0").
            if !obj.contains_key("type") {
                // You can also insert 0_u64 or "0x0" depending on what your RPC expects.
                obj.insert("type".into(), serde_json::Value::String("0x0".into()));
            }

            // Now attempt to deserialize into a TransactionReceipt.  Unknown fields
            // are ignored by serde as long as the struct doesn’t use `#[serde(deny_unknown_fields)]`.
            let receipt: TransactionReceipt = serde_json::from_value(serde_json::Value::Object(obj.clone()))?;

            Ok(Some(receipt))
        }
    }
}
