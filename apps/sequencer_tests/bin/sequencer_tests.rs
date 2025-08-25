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
use blocksense_config::get_sequencer_and_feed_configs;
use blocksense_config::SequencerConfig;
use blocksense_crypto::JsonSerializableSignature;
use blocksense_data_feeds::generate_signature::generate_signature;
use blocksense_feed_registry::registry::await_time;
use blocksense_feed_registry::types::{DataFeedPayload, FeedType, PayloadMetaData};
use curl::easy::Handler;
use curl::easy::WriteError;
use curl::easy::{Easy, Easy2};
use eyre::Result;
use futures::future::join_all;
use json_patch::merge;
use port_scanner::scan_port;
use regex::Regex;
use serde_json::json;
use serde_json::Value;
use std::io::stdout;
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::task::JoinHandle;

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
    _safe_contracts_per_net: &[String], // TODO: use when integration test starts using two rounds consensus
    contracts_in_networks: &[String],
) -> JoinHandle<()> {
    //"contract_address": Some(contracts_in_networks[0].to_owned()), "safe_address": None::<String>
    let config_patch = json!(
    {
        "main_port": SEQUENCER_MAIN_PORT,
        "admin_port": SEQUENCER_ADMIN_PORT,
        "providers": {
            "ETH1": {"url": format!("http://127.0.0.1:{}", eth_networks_ports[0]), "private_key_path": format!("{}{}", PROVIDERS_KEY_PREFIX, eth_networks_ports[0]), "contracts": [{"name": "AggregatedDataFeedStore", "address": Some(contracts_in_networks[0].to_owned())}]},
            "ETH2": {"url": format!("http://127.0.0.1:{}", eth_networks_ports[1]), "private_key_path": format!("{}{}", PROVIDERS_KEY_PREFIX, eth_networks_ports[1]), "contracts": [{"name": "AggregatedDataFeedStore", "address": Some(contracts_in_networks[0].to_owned())}]}
        },
        "send_aggregated_updates_to_publishers": false,

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

    write_file("/tmp/feeds_config_v2.json", feeds.to_string().as_bytes()).await;

    tokio::task::Builder::new()
        .name("sequencer_runner")
        .spawn(async move {
            let mut command = Command::new("cargo");
            let command = command.args(["run", "--bin", "sequencer"]);
            let sequencer = command
                .env("SEQUENCER_LOG_LEVEL", "INFO")
                .env("SEQUENCER_CONFIG_DIR", "/tmp")
                .env("FEEDS_CONFIG_DIR", "/tmp");

            sequencer.status().await.expect("process failed to execute");
        })
        .expect("Failed to spawn interrupt watcher!")
}

async fn wait_for_sequencer_to_accept_votes(max_time_to_wait_secs: u64) {
    let now = SystemTime::now();

    let ports = vec![SEQUENCER_MAIN_PORT, SEQUENCER_ADMIN_PORT];

    for port in ports {
        while !scan_port(port) {
            await_time(500).await;
            match now.elapsed() {
                Ok(elapsed) => {
                    if elapsed.as_secs() > max_time_to_wait_secs {
                        panic!(
                            "Sequencer took more than {max_time_to_wait_secs} seconds to start listening for reports"
                        );
                    }
                }
                Err(e) => {
                    panic!("Error: {e:?}");
                }
            }
        }
    }
}

async fn deploy_contract_to_networks(ports: &Vec<i32>) -> Vec<String> {
    let mut contract_addresses = Vec::new();

    for port in ports {
        let status = Command::new("sh")
        .arg("-c")
        .arg("yarn && cd libs/ts/contracts && yarn && just build-ts && yarn build && echo y | yarn hardhat deploy --networks local")
        .env("NETWORKS","local")
        .env("RPC_URL_LOCAL",format!("http://127.0.0.1:{port}/").as_str())
        .env("FEED_IDS_LOCAL", "0,3,4")
        .env("DEPLOYER_ADDRESS_IS_LEDGER_LOCAL", "false")
        .env("DEPLOYER_ADDRESS_LOCAL", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
        .env("DEPLOYER_PRIVATE_KEY_LOCAL", "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
        .env("ADMIN_MULTISIG_THRESHOLD_LOCAL", "1")
        .env("ADMIN_MULTISIG_OWNERS_LOCAL", "")
        .env("SEQUENCER_ADDRESS_LOCAL", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
        .env("REPORTER_MULTISIG_ENABLE_LOCAL", "false")
        .env("REPORTER_MULTISIG_THRESHOLD_LOCAL", "2")
        .env("REPORTER_MULTISIG_SIGNERS_LOCAL", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8,0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC")
        .status()
        .await
        .expect("failed to deploy contract to service on port {port}");

        assert!(
            status.success(),
            "Deployment process exited with a failure: {status}"
        );

        let data = fs::read_to_string("config/evm_contracts_deployment_v2/local.json")
            .await
            .expect("cannot read json file");
        let local_json: Value = serde_json::from_str(&data).expect("Could not parse json file!");
        contract_addresses.push(
            local_json["contracts"]["coreContracts"]["UpgradeableProxyADFS"]["address"]
                .as_str()
                .expect("Could not get contracts data from json config")
                .to_owned(),
        );
        println!("contract_addresses deployed on port {port} = {contract_addresses:?}");
    }
    contract_addresses
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
        format!("http://127.0.0.1:{SEQUENCER_ADMIN_PORT}/get_feed_report_interval/{FEED_ID}")
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
            format!(
                "127.0.0.1:{SEQUENCER_ADMIN_PORT}/get_key/ETH1/00000000000000000000000000000001"
            )
            .as_str()
        )
    );
    println!(
        "ETH2 value = {}",
        send_get_request(
            format!(
                "127.0.0.1:{SEQUENCER_ADMIN_PORT}/get_key/ETH2/00000000000000000000000000000001"
            )
            .as_str()
        )
    );

    // Verify expected data is set to contract in ETH1
    println!("DEBUG: expected_value = {expected_value}");
    let recvd_val = send_get_request(
        format!("127.0.0.1:{SEQUENCER_ADMIN_PORT}/get_key/ETH1/00000000000000000000000000000001")
            .as_str(),
    );
    println!("DEBUG: recvd_val = {recvd_val}");
    assert!(
        send_get_request(
            format!(
                "127.0.0.1:{SEQUENCER_ADMIN_PORT}/get_key/ETH1/00000000000000000000000000000001"
            )
            .as_str()
        ) == format!("{expected_value}")
    );
    // Verify expected data is set to contract in ETH2
    assert!(
        send_get_request(
            format!(
                "127.0.0.1:{SEQUENCER_ADMIN_PORT}/get_key/ETH2/00000000000000000000000000000001"
            )
            .as_str()
        ) == format!("{expected_value}")
    );
}

async fn cleanup_spawned_processes() {
    let mut children = vec![];
    {
        let process = "sequencer";
        println!("Killing process: {process}");
        children.push(kill_process(process));
    }
    join_all(children).await;
}

async fn kill_process(process_name: &str) {
    let mut command = Command::new("pkill");
    let command = command.args(["-x", "-9", process_name]);

    command.status().await.expect("process failed to execute");
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
            .wallet(EthereumWallet::from(signer.clone()))
            .connect_http(format!("http:127.0.0.1:{port}").as_str().parse().unwrap());

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
                data: Bytes::new(),
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
            .call()
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

        let multisig_addr = res;

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

    let contracts_in_networks = deploy_contract_to_networks(&PROVIDERS_PORTS.to_vec()).await;

    let seq = spawn_sequencer(
        PROVIDERS_PORTS.as_ref(),
        &safe_contracts_per_net,
        &contracts_in_networks,
    )
    .await;

    wait_for_sequencer_to_accept_votes(5 * 60).await;

    println!("\n * Assert provider status is 'AwaitingFirstUpdate' at the start:\n");
    {
        let expected_response = r#"{
  "ETH1": "AwaitingFirstUpdate",
  "ETH2": "AwaitingFirstUpdate"
}"#;
        let actual_response = send_get_request(
            format!("127.0.0.1:{SEQUENCER_ADMIN_PORT}/list_provider_status").as_str(),
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

        println!("serialized_payload={serialized_payload}");

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
            format!("127.0.0.1:{SEQUENCER_ADMIN_PORT}/list_provider_status").as_str(),
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

        println!("serialized_payload={serialized_payload}");

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

        println!("serialized_payload={serialized_payload}");

        assert!(send_report("post_reports_batch", serialized_payload).contains("401 Unauthorized"));

        wait_for_value_to_be_updated_to_contracts()
            .await
            .expect("Error while waiting for value to be updated to contracts.");

        verify_expected_data_in_contracts(CORRECT_AND_WRONG_VALS[0]);
    }

    println!("\n * Assert provider status is 'Disabled' after disabling provider:\n");
    {
        let response_from_disable = send_post_request(
            format!("127.0.0.1:{SEQUENCER_ADMIN_PORT}/disable_provider/ETH1").as_str(),
        );

        assert_eq!("", response_from_disable);

        let expected_response = r#"{
  "ETH1": "Disabled",
  "ETH2": "LastUpdateSucceeded"
}"#;
        let actual_response = send_get_request(
            format!("127.0.0.1:{SEQUENCER_ADMIN_PORT}/list_provider_status").as_str(),
        );
        assert_eq!(expected_response, actual_response);
    }

    fn mask_timestamps(response: &str) -> String {
        let re = Regex::new(r#""end_slot_timestamp": \d+"#).unwrap();
        re.replace_all(response, r#""end_slot_timestamp": REDACTED"#)
            .to_string()
    }

    println!("\n * Get history returns history of the updates:\n");
    {
        let actual_response =
            send_get_request(format!("127.0.0.1:{SEQUENCER_ADMIN_PORT}/get_history").as_str());

        let actual_response = mask_timestamps(actual_response.as_str());

        let expected_response = r#"{
  "aggregate_history": {
    "1": [
      {
        "value": {
          "Numerical": 80000.8
        },
        "update_number": 0,
        "end_slot_timestamp": REDACTED
      },
      {
        "value": {
          "Numerical": 123456.7
        },
        "update_number": 1,
        "end_slot_timestamp": REDACTED
      },
      {
        "value": {
          "Numerical": 115000.5
        },
        "update_number": 2,
        "end_slot_timestamp": REDACTED
      }
    ]
  }
}"#;
        assert_eq!(expected_response, actual_response);
    }

    cleanup_spawned_processes().await;

    match seq.await {
        Ok(_) => {
            println!("Sequencer thread done.");
        }
        Err(e) => {
            println!("sequencer thread err {e:?}");
        }
    }

    Ok(())
}
