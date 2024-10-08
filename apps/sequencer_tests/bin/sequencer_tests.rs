use alloy::hex::ToHexExt;
use alloy::node_bindings::Anvil;
use config::get_sequencer_and_feed_configs;
use config::SequencerConfig;
use crypto::JsonSerializableSignature;
use curl::easy::Handler;
use curl::easy::WriteError;
use curl::easy::{Easy, Easy2};
use data_feeds::connector::post::generate_signature;
use eyre::Result;
use feed_registry::types::{DataFeedPayload, FeedResult, FeedType, PayloadMetaData};
use json_patch::merge;
use port_scanner::scan_port;
use serde_json::json;
use std::io::stdout;
use std::process::Command;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::time;
use tokio::time::Duration;

use tokio::fs::File;
use tokio::io::AsyncWriteExt;

const PROVIDERS_PORTS: [i32; 2] = [8547, 8548];
const PROVIDERS_KEY_PREFIX: &str = "/tmp/key_";
const BATCHED_REPORT_VAL: f64 = 100000.1;
const REPORT_VAL: f64 = 80000.8;
const FEED_ID: &str = "1";
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

async fn spawn_sequencer(eth_networks_ports: [i32; 2]) -> thread::JoinHandle<()> {
    let config_patch = json!(
    {
        "main_port": SEQUENCER_MAIN_PORT,
        "admin_port": SEQUENCER_ADMIN_PORT,
        "providers": {
            "ETH1": {"url": format!("http://127.0.0.1:{}", eth_networks_ports[0]), "private_key_path": format!("{}{}", PROVIDERS_KEY_PREFIX, eth_networks_ports[0])},
            "ETH2": {"url": format!("http://127.0.0.1:{}", eth_networks_ports[1]), "private_key_path": format!("{}{}", PROVIDERS_KEY_PREFIX, eth_networks_ports[1])}
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
    feed.report_interval_ms = 3000;
    feed.quorum_percentage = 0.001;

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
        let mut interval = time::interval(Duration::from_millis(500));
        interval.tick().await; // The first tick completes immediately.
        interval.tick().await;
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

fn send_report(endpoint: &str, payload_json: serde_json::Value) {
    let mut easy = Easy::new();
    easy.url(format!("127.0.0.1:{SEQUENCER_MAIN_PORT}/{endpoint}").as_str())
        .unwrap();
    easy.post(true).unwrap();

    easy.post_fields_copy(payload_json.to_string().as_bytes())
        .unwrap();

    // Set a closure to handle the response
    easy.write_function(|data| Ok(std::io::Write::write(&mut stdout(), data).unwrap()))
        .unwrap();

    easy.perform().unwrap();
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
    let mut interval = time::interval(Duration::from_millis(report_time_interval_ms + 1000)); // give 1 second tolerance
    interval.tick().await; // The first tick completes immediately.
    interval.tick().await;
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
    let mut providers = Vec::new();

    for port in PROVIDERS_PORTS {
        providers.push(Anvil::new().port(port as u16).try_spawn()?);
    }

    for provider in providers.iter() {
        let signer = provider.keys()[0].clone();
        let signer = signer.to_bytes().encode_hex();

        write_file(
            format!("/tmp/key_{}", provider.port()).as_str(),
            signer.as_bytes(),
        )
        .await;
    }

    let seq = spawn_sequencer(PROVIDERS_PORTS).await;

    wait_for_sequencer_to_accept_votes(5 * 60).await;

    deploy_contract_to_networks(vec!["ETH1", "ETH2"]);

    // Send single update and verify value posted to contract:
    {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("System clock set before EPOCH")
            .as_millis();

        let result = FeedResult::Result {
            result: FeedType::Numerical(REPORT_VAL),
        };
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

    // Send batched update and verify value posted to contract:
    {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("System clock set before EPOCH")
            .as_millis();

        let mut payload = Vec::new();

        // Prepare the batch to be sent
        for (id, key) in REPORTERS_INFO {
            let result = FeedResult::Result {
                result: FeedType::Numerical(BATCHED_REPORT_VAL),
            };

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
