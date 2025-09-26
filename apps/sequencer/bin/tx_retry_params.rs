use std::env;
use std::fs;
use std::sync::Arc;

use alloy::network::TransactionBuilder;
use alloy::rpc::types::TransactionRequest;
use alloy::signers::local::PrivateKeySigner;
use anyhow::{anyhow, Context, Result};
use blocksense_config::{AllFeedsConfig, Provider as ProviderConfig};
use blocksense_metrics::metrics::ProviderMetrics;
use reqwest::Url;
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

    let tx_request = TransactionRequest::default().with_from(signer.address());
    let gas_limit = get_gas_limit(
        DEFAULT_NETWORK_NAME,
        &rpc_provider.provider,
        &tx_request,
        provider_config.transaction_retry_timeout_secs as u64,
        provider_config.transaction_gas_limit,
    )
    .await;

    println!("Estimated gas limit: {}", gas_limit);

    let gas_fees = get_tx_retry_params(
        DEFAULT_NETWORK_NAME,
        &rpc_provider.provider,
        &rpc_provider.provider_metrics,
        &signer.address(),
        provider_config.transaction_retry_timeout_secs as u64,
        0,
        provider_config.retry_fee_increment_fraction,
    )
    .await
    .map_err(|err| anyhow!(err.to_string()))?;

    match gas_fees {
        GasFees::Legacy(gas_price) => {
            println!("Legacy gas price (wei): {}", gas_price.gas_price);
        }
        GasFees::Eip1559(gas_fees) => {
            println!(
                "EIP-1559 max fee per gas (wei): {}",
                gas_fees.max_fee_per_gas
            );
            println!("EIP-1559 priority fee (wei): {}", gas_fees.priority_fee);
        }
    }

    Ok(())
}
