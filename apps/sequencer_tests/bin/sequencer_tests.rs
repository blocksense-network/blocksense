use alloy::hex::ToHexExt;
use alloy::node_bindings::Anvil;
use curl::easy::Easy;
use eyre::Result;
use port_scanner::scan_port;
use std::io::stdout;
use std::process::Command;
use std::thread;
use std::time::SystemTime;
use std::{fs::File, io::Write};
use tokio::time;
use tokio::time::Duration;

fn spawn_sequencer(eth_networks_ports: [i32; 2]) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let mut command = Command::new("cargo");
        let command = command.args(["run", "--bin", "sequencer"]);
        let sequencer = command
            .env(
                "WEB3_PRIVATE_KEY_ETH1",
                format!("/tmp/key_{}", eth_networks_ports[0]),
            )
            .env(
                "WEB3_PRIVATE_KEY_ETH2",
                format!("/tmp/key_{}", eth_networks_ports[1]),
            )
            .env(
                "WEB3_URL_ETH1",
                format!("http://127.0.0.1:{}", eth_networks_ports[0]),
            )
            .env(
                "WEB3_URL_ETH2",
                format!("http://127.0.0.1:{}", eth_networks_ports[1]),
            );

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

const PROVIDERS_PORTS: [i32; 2] = [8547, 8548];

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

    for net in vec!["ETH1", "ETH2"] {
        let mut easy = Easy::new();
        easy.url(format!("http://127.0.0.1:8877/deploy/{}", net).as_str())
            .unwrap();
        easy.write_function(|data| {
            stdout().write_all(data).unwrap();
            Ok(data.len())
        })
        .unwrap();
        easy.perform().unwrap();
    }

    {
        let mut interval = time::interval(Duration::from_millis(20000));
        interval.tick().await; // The first tick completes immediately.
        interval.tick().await;
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
