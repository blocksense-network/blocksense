use alloy::hex::ToHexExt;
use alloy::node_bindings::Anvil;
use curl::easy::Handler;
use curl::easy::WriteError;
use curl::easy::{Easy, Easy2};
use eyre::Result;
use json_patch::merge;
use port_scanner::scan_port;
use sequencer_config::get_sequencer_config_file_path;
use serde_json::json;
use std::fs;
use std::io::stdout;
use std::process::Command;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
use std::{fs::File, io::Write};
use tokio::time;
use tokio::time::Duration;
use utils::read_file;

const PROVIDERS_PORTS: [i32; 2] = [8547, 8548];
const REPORT_VAL: &str = "47a0284000000000000000000000000000000000000000000000000000000000";

struct Collector(Vec<u8>);

impl Handler for Collector {
    fn write(&mut self, data: &[u8]) -> Result<usize, WriteError> {
        self.0.extend_from_slice(data);
        Ok(data.len())
    }
}

fn spawn_sequencer(eth_networks_ports: [i32; 2]) -> thread::JoinHandle<()> {
    let config_patch = json!(
    {
        "providers": {
            "ETH1": {"url": format!("http://127.0.0.1:{}", eth_networks_ports[0])},
            "ETH2": {"url": format!("http://127.0.0.1:{}", eth_networks_ports[1])}
        }
    });

    let config_file_path = get_sequencer_config_file_path();

    let data = read_file(config_file_path.as_str());

    let mut sequencer_config =
        serde_json::from_str(data.as_str()).expect("Config file is not valid JSON!");

    merge(&mut sequencer_config, &config_patch);

    fs::write("/tmp/sequencer_config.json", sequencer_config.to_string())
        .expect("Unable to write config file");

    thread::spawn(move || {
        let mut command = Command::new("cargo");
        let command = command.args(["run", "--bin", "sequencer"]);
        let sequencer = command
            .env("SEQUENCER_LOGGING_LEVEL", "INFO")
            .env("SEQUENCER_CONFIG_DIR", "/tmp");

        sequencer.status().expect("process failed to execute");
    })
}

async fn wait_for_sequencer_to_accept_votes(max_time_to_wait_secs: u64) {
    let now = SystemTime::now();
    while !scan_port(8877) {
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
        send_get_request(format!("http://127.0.0.1:8877/deploy/{}", net).as_str());
    }
}

fn send_get_request(request: &str) -> String {
    let mut easy = Easy2::new(Collector(Vec::new()));
    easy.get(true).unwrap();
    easy.url(request).unwrap();
    easy.perform().unwrap();
    format!("{}", String::from_utf8_lossy(&easy.get_ref().0))
}

fn send_report(payload_json: serde_json::Value) {
    let mut easy = Easy::new();
    easy.url("127.0.0.1:8877/post_report").unwrap();
    easy.post(true).unwrap();

    easy.post_fields_copy(&payload_json.to_string().as_bytes())
        .unwrap();

    // Set a closure to handle the response
    easy.write_function(|data| Ok(stdout().write(data).unwrap()))
        .unwrap();

    easy.perform().unwrap();
}

fn cleanup_spawned_processes() {
    let mut children = vec![];
    for process in vec!["sequencer"] {
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

        let mut file = File::create(format!("/tmp/key_{}", provider.port()))?;
        file.write_all(signer.as_bytes())?;
    }

    let seq = spawn_sequencer(PROVIDERS_PORTS);

    wait_for_sequencer_to_accept_votes(5 * 60).await;

    deploy_contract_to_networks(vec!["ETH1", "ETH2"]);

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("System clock set before EPOCH")
        .as_millis();

    send_report(json!({
        "reporter_id": 0,
        "feed_id": "YahooFinance.BTC/USD",
        "timestamp": timestamp,
        "result": REPORT_VAL
    }));

    {
        let report_time_interval_ms: u64 =
            send_get_request("http://127.0.0.1:8877/get_feed_report_interval/1").parse()?;
        let mut interval = time::interval(Duration::from_millis(report_time_interval_ms + 1000)); // give 1 second tolerance
        interval.tick().await; // The first tick completes immediately.
        interval.tick().await;
    }

    println!(
        "ETH1 value = {}",
        send_get_request("127.0.0.1:8877/get_key/ETH1/00000001")
    );
    println!(
        "ETH2 value = {}",
        send_get_request("127.0.0.1:8877/get_key/ETH2/00000001")
    );

    assert!(
        send_get_request("127.0.0.1:8877/get_key/ETH1/00000001") == "0x".to_string() + REPORT_VAL
    );
    assert!(
        send_get_request("127.0.0.1:8877/get_key/ETH2/00000001") == "0x".to_string() + REPORT_VAL
    );

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
