use rand::Rng;
use reqwest::blocking::{multipart, Client};
use std::fs::File;
use std::io::Write;
use std::process::{Child, Command};
use std::thread;
use std::time::Duration;

fn start_sequencer_runner() -> Child {
    Command::new("cargo")
        .args(&["run", "--bin", "sequencer"])
        .spawn()
        .expect("Failed to start sequencer_runner")
}

fn stop_sequencer_runner(child: &mut Child) {
    child.kill().expect("Failed to stop sequencer_runner");
    child.wait().expect("Failed to wait on sequencer_runner");
}

#[test]
#[ignore]
fn test_plugin_upload_get_size() {
    // Start the sequencer_runner binary using std::process::Command
    let mut child = start_sequencer_runner();

    // Wait for the server to start
    thread::sleep(Duration::from_secs(2));

    let client = Client::new();

    // Generate a random 100-byte file in memory
    let mut rng = rand::thread_rng();
    let random_bytes: Vec<u8> = (0..100).map(|_| rng.gen()).collect();

    // Write the random bytes to a temporary file
    let mut file = File::create("test_plugin.wasm").expect("Failed to create temporary file");
    file.write_all(&random_bytes)
        .expect("Failed to write to temporary file");

    // Upload the file
    let form = multipart::Form::new()
        .text("name", "test_plugin")
        .text("namespace", "test_namespace")
        .file("wasm", "test_plugin.wasm")
        .expect("Failed to attach file");

    let upload_resp = client
        .post("http://127.0.0.1:8877/registry/plugin/upload")
        .multipart(form)
        .send()
        .expect("Failed to send upload request");

    assert!(upload_resp.status().is_success());

    // Check the size endpoint
    let size_resp = client
        .get("http://127.0.0.1:8877/registry/plugin/size")
        .send()
        .expect("Failed to send size request");

    assert!(size_resp.status().is_success());
    let size: usize = size_resp
        .text()
        .expect("Failed to read size response")
        .parse()
        .expect("Failed to parse size response");
    assert!(size > 100);

    // Retrieve the file and check it is identical
    let get_resp = client
        .get("http://127.0.0.1:8877/registry/plugin/get/test_namespace/test_plugin")
        .send()
        .expect("Failed to send get request");

    assert!(get_resp.status().is_success());
    let get_body = get_resp.bytes().expect("Failed to read get response");

    assert_eq!(get_body.as_ref(), random_bytes.as_slice());

    // Stop the sequencer_runner binary
    stop_sequencer_runner(&mut child);
}
