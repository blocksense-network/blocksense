use alloy::hex;
use alloy::hex::FromHex;
use alloy::hex::ToHexExt;
use alloy::network::EthereumWallet;
use alloy::node_bindings::Anvil;
use alloy::primitives::Address;
use alloy::primitives::Bytes;
use alloy::primitives::Uint;
use alloy::providers::ProviderBuilder;
use alloy::signers::local::PrivateKeySigner;
use alloy::sol;
use alloy::sol_types::SolCall;
use config::get_sequencer_and_feed_configs;
use config::SequencerConfig;
use crypto::JsonSerializableSignature;
use curl::easy::Handler;
use curl::easy::WriteError;
use curl::easy::{Easy, Easy2};
use data_feeds::generate_signature::generate_signature;
use eyre::Result;
use feed_registry::registry::await_time;
use feed_registry::types::{DataFeedPayload, FeedType, PayloadMetaData};
use json_patch::merge;
use port_scanner::scan_port;
use serde_json::json;
use std::io::stdout;
use std::process::Command;
use std::str::FromStr;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use tokio::fs::File;
use tokio::io::AsyncWriteExt;

const PROVIDERS_PORTS: [i32; 2] = [8547, 8548];
const PROVIDERS_KEY_PREFIX: &str = "/tmp/key_";
const BATCHED_REPORT_VAL: f64 = 123456.7;
const REPORT_VAL: f64 = 80000.8;
const FEED_ID: &str = "1";
// We use the second value to generate a wrong signature in a batch
const CORRECT_AND_WRONG_VALS: [f64; 2] = [115000.5, 110000.1];

const REPORTERS_INFO: [(u64, &str); 2] = [
    (
        0,
        "536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003",
    ),
    (
        1,
        "4afe5f6c612e6b7f78e423bd8f102ebb8d5010ad8bf3085476f847853d1470ab",
    ),
];
const SEQUENCER_MAIN_PORT: u16 = 8787;
const SEQUENCER_ADMIN_PORT: u16 = 5557;

sol! {
    #[allow(clippy::too_many_arguments)]
    #[sol(rpc)]
    SafeABI,
    "Safe.json"
}

sol! {
    #[allow(clippy::too_many_arguments)]
    #[sol(rpc)]
    SafeFactoryABI,
    "SafeProxyFactory.json"
}

struct Collector(Vec<u8>);

impl Handler for Collector {
    fn write(&mut self, data: &[u8]) -> Result<usize, WriteError> {
        self.0.extend_from_slice(data);
        Ok(data.len())
    }
}

async fn write_file(key_path: &str, content: &[u8]) {
    let mut f = File::create(key_path).await.expect("Could not create file");
    f.write_all(content).await.expect("Failed to write to file");
    f.flush().await.expect("Could not flush file");
}

async fn spawn_sequencer(
    eth_networks_ports: &[i32],
    safe_contracts_per_net: &[String],
) -> thread::JoinHandle<()> {
    let config_patch = json!(
    {
        "main_port": SEQUENCER_MAIN_PORT,
        "admin_port": SEQUENCER_ADMIN_PORT,
        "providers": {
            "ETH1": {"url": format!("http://127.0.0.1:{}", eth_networks_ports[0]), "private_key_path": format!("{}{}", PROVIDERS_KEY_PREFIX, eth_networks_ports[0]), "safe_address": safe_contracts_per_net[0]},
            "ETH2": {"url": format!("http://127.0.0.1:{}", eth_networks_ports[1]), "private_key_path": format!("{}{}", PROVIDERS_KEY_PREFIX, eth_networks_ports[1]), "safe_address": safe_contracts_per_net[1]}
        },
    });

    let (sequencer_config, feeds_config) = get_sequencer_and_feed_configs();
    let mut sequencer_config = serde_json::to_value(&sequencer_config)
        .expect("Error serializing `sequencer_config` to JSON");

    merge(&mut sequencer_config, &config_patch);

    // Check for correctness after patch is applied:
    let _: SequencerConfig = serde_json::from_str(sequencer_config.to_string().as_str())
        .expect("Error after patching the config file!");

    write_file(
        "/tmp/sequencer_config.json",
        sequencer_config.to_string().as_bytes(),
    )
    .await;

    let mut feed = feeds_config
        .feeds
        .first()
        .expect("Feeds array empty!")
        .clone();
    feed.id = 1;
    feed.schedule.interval_ms = 3000;
    feed.quorum.percentage = 0.1;

    let feeds = json!({
        "feeds": [
            feed
        ]}
    );

    write_file("/tmp/feeds_config.json", feeds.to_string().as_bytes()).await;

    thread::spawn(move || {
        let mut command = Command::new("cargo");
        let command = command.args(["run", "--bin", "sequencer"]);
        let sequencer = command
            .env("SEQUENCER_LOG_LEVEL", "INFO")
            .env("SEQUENCER_CONFIG_DIR", "/tmp")
            .env("FEEDS_CONFIG_DIR", "/tmp");

        sequencer.status().expect("process failed to execute");
    })
}

async fn wait_for_sequencer_to_accept_votes(max_time_to_wait_secs: u64) {
    let now = SystemTime::now();
    while !scan_port(SEQUENCER_MAIN_PORT) {
        await_time(500).await;
        match now.elapsed() {
            Ok(elapsed) => {
                if elapsed.as_secs() > max_time_to_wait_secs {
                    panic!(
                        "Sequencer took more than {} seconds to start listening for reports",
                        max_time_to_wait_secs
                    );
                }
            }
            Err(e) => {
                panic!("Error: {e:?}");
            }
        }
    }
}

fn deploy_contract_to_networks(networks: Vec<&str>) {
    for net in networks {
        send_get_request(
            format!(
                "http://127.0.0.1:{}/deploy/{}/price_feed",
                SEQUENCER_ADMIN_PORT, net
            )
            .as_str(),
        );
    }
}

fn send_get_request(request: &str) -> String {
    let mut easy = Easy2::new(Collector(Vec::new()));
    easy.get(true).unwrap();
    easy.url(request).unwrap();
    easy.perform().unwrap();
    format!("{}", String::from_utf8_lossy(&easy.get_ref().0))
}

fn send_post_request(request: &str) -> String {
    let mut easy = Easy2::new(Collector(Vec::new()));
    easy.post(true).unwrap();
    easy.url(request).unwrap();
    easy.perform().unwrap();
    format!("{}", String::from_utf8_lossy(&easy.get_ref().0))
}

fn send_report(endpoint: &str, payload_json: serde_json::Value) -> String {
    let mut result = Vec::new();
    let mut easy = Easy::new();
    {
        easy.url(format!("127.0.0.1:{SEQUENCER_MAIN_PORT}/{endpoint}").as_str())
            .unwrap();

        easy.post(true).unwrap();

        easy.post_fields_copy(payload_json.to_string().as_bytes())
            .unwrap();

        let mut transfer = easy.transfer();

        // Set a closure to handle the response
        transfer
            .write_function(|data: &[u8]| {
                result.extend_from_slice(data);
                Ok(std::io::Write::write(&mut stdout(), data).unwrap())
            })
            .unwrap();

        transfer.perform().unwrap();
    }
    String::from_utf8(result).expect("returned bytes must be valid utf8")
}

async fn wait_for_value_to_be_updated_to_contracts() -> Result<()> {
    let report_time_interval_ms: u64 = send_get_request(
        format!(
            "http://127.0.0.1:{}/get_feed_report_interval/{}",
            SEQUENCER_ADMIN_PORT, FEED_ID
        )
        .as_str(),
    )
    .parse()?;
    await_time(report_time_interval_ms + 1000).await; // give 1 second tolerance
    Ok(())
}

fn verify_expected_data_in_contracts(expected_value: f64) {
    println!(
        "ETH1 value = {}",
        send_get_request(
            format!("127.0.0.1:{}/get_key/ETH1/00000001", SEQUENCER_ADMIN_PORT).as_str()
        )
    );
    println!(
        "ETH2 value = {}",
        send_get_request(
            format!("127.0.0.1:{}/get_key/ETH2/00000001", SEQUENCER_ADMIN_PORT).as_str()
        )
    );

    // Verify expected data is set to contract in ETH1
    assert!(
        send_get_request(
            format!("127.0.0.1:{}/get_key/ETH1/00000001", SEQUENCER_ADMIN_PORT).as_str()
        ) == format!("{}", expected_value)
    );
    // Verify expected data is set to contract in ETH2
    assert!(
        send_get_request(
            format!("127.0.0.1:{}/get_key/ETH2/00000001", SEQUENCER_ADMIN_PORT).as_str()
        ) == format!("{}", expected_value)
    );
}

fn cleanup_spawned_processes() {
    let mut children = vec![];
    {
        let process = "sequencer";
        println!("Killing process: {}", process);
        children.push(thread::spawn(move || {
            let mut command = Command::new("pkill");
            let command = command.args(["-x", "-9", process]);

            command.status().expect("process failed to execute");
        }));
    }
    for child in children {
        // Wait for the thread to finish. Returns a result.
        let _ = child.join();
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let mut anvils = Vec::new();
    let mut providers = Vec::new();
    let mut safe_contracts_per_net = Vec::new();

    // Setup anvil instances, providers connected to them and deploy gnosis safe contracts:
    for port in PROVIDERS_PORTS {
        let anvil = Anvil::new()
            .port(port as u16)
            .fork("https://eth-sepolia.public.blastapi.io")
            .try_spawn()?;

        let owner = anvil.addresses()[0];

        let signer: PrivateKeySigner = anvil.keys()[0].clone().into();

        let provider = ProviderBuilder::new()
            // Adds the `ChainIdFiller`, `GasFiller` and the `NonceFiller` layers.
            // This is the recommended way to set up the provider.
            .with_recommended_fillers()
            .wallet(EthereumWallet::from(signer.clone()))
            .on_http(format!("http:127.0.0.1:{port}").as_str().parse().unwrap());

        let safe_iface = SafeABI::new(
            Address::from_str("0x41675C099F32341bf84BFc5382aF534df5C7461a")
                .ok()
                .unwrap(),
            provider.clone(),
        );

        let safe_factory_iface = Box::leak(Box::new(SafeFactoryABI::new(
            Address::from_str("0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67")
                .ok()
                .unwrap(),
            provider.clone(),
        )));

        let encoded = hex::encode(
            SafeABI::setupCall {
                _owners: vec![owner],
                _threshold: Uint::from(1),
                to: Address::default(),
                data: Bytes::from_hex("0x").unwrap(),
                fallbackHandler: Address::from_str("0xfd0732dc9e303f09fcef3a7388ad10a83459ec99")
                    .ok()
                    .unwrap(),
                paymentToken: Address::default(),
                payment: Uint::from(0),
                paymentReceiver: Address::default(),
            }
            .abi_encode(),
        );

        // First perform a call only (no tx sent) to get the contract address (it is easier than parsing the logs of the receipt)
        let res = safe_factory_iface
            .createProxyWithNonce(
                *safe_iface.address(),
                Bytes::from_hex(encoded.clone()).unwrap(),
                Uint::from(1500),
            )
            .await
            .unwrap();

        // Then actually send a transaction with the same parameters as above to deploy the contract
        let receipt = safe_factory_iface
            .createProxyWithNonce(
                *safe_iface.address(),
                Bytes::from_hex(encoded).unwrap(),
                Uint::from(1500),
            )
            .send()
            .await
            .unwrap()
            .get_receipt()
            .await;

        println!("deploy gnosis safe receipt = {receipt:?}");

        let multisig_addr = res.proxy;

        safe_contracts_per_net.push(multisig_addr.to_string());
        println!("multisig_addr = {multisig_addr}");

        anvils.push(anvil);
        providers.push(provider);
    }

    for anvil in anvils.iter() {
        let signer = anvil.keys()[0].clone();
        let signer = signer.to_bytes().encode_hex();

        write_file(
            format!("/tmp/key_{}", anvil.port()).as_str(),
            signer.as_bytes(),
        )
        .await;
    }

    let seq = spawn_sequencer(PROVIDERS_PORTS.as_ref(), &safe_contracts_per_net).await;

    wait_for_sequencer_to_accept_votes(5 * 60).await;

    deploy_contract_to_networks(vec!["ETH1", "ETH2"]);

    println!("\n * Assert provider status is 'AwaitingFirstUpdate' at the start:\n");
    {
        let expected_response = r#"{
  "ETH1": "AwaitingFirstUpdate",
  "ETH2": "AwaitingFirstUpdate"
}"#;
        let actual_response = send_get_request(
            format!("127.0.0.1:{}/list_provider_status", SEQUENCER_ADMIN_PORT).as_str(),
        );
        assert_eq!(expected_response, actual_response);
    }

    println!("\n * Send single update and verify value posted to contract:\n");
    {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("System clock set before EPOCH")
            .as_millis();

        let result = Ok(FeedType::Numerical(REPORT_VAL));
        let (id, key) = REPORTERS_INFO[0];
        let signature = generate_signature(key, FEED_ID, timestamp, &result).unwrap();

        let payload = DataFeedPayload {
            payload_metadata: PayloadMetaData {
                reporter_id: id,
                feed_id: FEED_ID.to_string(),
                timestamp,
                signature: JsonSerializableSignature { sig: signature },
            },
            result,
        };

        let serialized_payload = match serde_json::to_value(&payload) {
            Ok(payload) => payload,
            Err(_) => panic!("Failed serialization of payload!"), //TODO(snikolov): Handle without panic
        };

        println!("serialized_payload={}", serialized_payload);

        send_report("post_report", serialized_payload);

        wait_for_value_to_be_updated_to_contracts()
            .await
            .expect("Error while waiting for value to be updated to contracts.");

        verify_expected_data_in_contracts(REPORT_VAL);
    }

    println!("\n * Assert provider status is 'LastUpdateSucceeded' after first update:\n");
    {
        let expected_response = r#"{
  "ETH1": "LastUpdateSucceeded",
  "ETH2": "LastUpdateSucceeded"
}"#;
        let actual_response = send_get_request(
            format!("127.0.0.1:{}/list_provider_status", SEQUENCER_ADMIN_PORT).as_str(),
        );
        assert_eq!(expected_response, actual_response);
    }

    println!("\n * Send batched update and verify value posted to contract:\n");
    {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("System clock set before EPOCH")
            .as_millis();

        let mut payload = Vec::new();

        // Prepare the batch to be sent
        for (id, key) in REPORTERS_INFO {
            let result = Ok(FeedType::Numerical(BATCHED_REPORT_VAL));
            payload.push(DataFeedPayload {
                payload_metadata: PayloadMetaData {
                    reporter_id: id,
                    feed_id: FEED_ID.to_string(),
                    timestamp,
                    signature: JsonSerializableSignature {
                        sig: generate_signature(key, FEED_ID, timestamp, &result).unwrap(),
                    },
                },
                result,
            })
        }

        let serialized_payload = match serde_json::to_value(&payload) {
            Ok(payload) => payload,
            Err(_) => panic!("Failed serialization of payload!"), //TODO(snikolov): Handle without panic
        };

        println!("serialized_payload={}", serialized_payload);

        send_report("post_reports_batch", serialized_payload);

        wait_for_value_to_be_updated_to_contracts()
            .await
            .expect("Error while waiting for value to be updated to contracts.");

        verify_expected_data_in_contracts(BATCHED_REPORT_VAL);
    }

    println!("\n * Send batched update with one valid and one non-valid signature and verify value posted to contract:\n");
    {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("System clock set before EPOCH")
            .as_millis();

        let mut payload = Vec::new();

        // Prepare the batch to be sent
        for (i, (id, key)) in REPORTERS_INFO.iter().enumerate() {
            payload.push(DataFeedPayload {
                payload_metadata: PayloadMetaData {
                    reporter_id: *id,
                    feed_id: FEED_ID.to_string(),
                    timestamp,
                    signature: JsonSerializableSignature {
                        sig: generate_signature(
                            key,
                            FEED_ID,
                            timestamp,
                            // This will cause a corrupted signature on the second iteration,
                            // since the value we sign will not be the value we send below.
                            &Ok(FeedType::Numerical(CORRECT_AND_WRONG_VALS[0])),
                        )
                        .unwrap(),
                    },
                },
                result: Ok(FeedType::Numerical(CORRECT_AND_WRONG_VALS[i])),
            })
        }

        let serialized_payload = match serde_json::to_value(&payload) {
            Ok(payload) => payload,
            Err(_) => panic!("Failed serialization of payload!"), //TODO(snikolov): Handle without panic
        };

        println!("serialized_payload={}", serialized_payload);

        assert!(send_report("post_reports_batch", serialized_payload).contains("401 Unauthorized"));

        wait_for_value_to_be_updated_to_contracts()
            .await
            .expect("Error while waiting for value to be updated to contracts.");

        verify_expected_data_in_contracts(CORRECT_AND_WRONG_VALS[0]);
    }

    println!("\n * Assert provider status is 'Disabled' after disabling provider:\n");
    {
        let response_from_disable = send_post_request(
            format!("127.0.0.1:{}/disable_provider/ETH1", SEQUENCER_ADMIN_PORT).as_str(),
        );

        assert_eq!("", response_from_disable);

        let expected_response = r#"{
  "ETH1": "Disabled",
  "ETH2": "LastUpdateSucceeded"
}"#;
        let actual_response = send_get_request(
            format!("127.0.0.1:{}/list_provider_status", SEQUENCER_ADMIN_PORT).as_str(),
        );
        assert_eq!(expected_response, actual_response);
    }

    cleanup_spawned_processes();

    match seq.join() {
        Ok(_) => {
            println!("Sequencer thread done.");
        }
        Err(e) => {
            println!("sequencer thread err {:?}", e);
        }
    }

    Ok(())
}
