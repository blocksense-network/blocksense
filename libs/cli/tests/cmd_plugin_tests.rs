extern crate blocksense_cli;

use blocksense_cli::commands::plugin;

use assert_cmd::Command;
use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

fn is_valid_rust_syntax(path: &PathBuf) -> bool {
    let output = std::process::Command::new("rustc")
        .arg("--crate-type=lib")
        .arg("--emit=metadata")
        .arg(path)
        .output()
        .expect("Failed to execute rustc");

    // Clean up the metadata file that rustc generates
    let metadata_file = std::env::current_dir()
        .unwrap()
        .join("librequirements.rmeta");

    if metadata_file.exists() {
        std::fs::remove_file(metadata_file).expect("Failed to delete metadata file");
    }

    output.status.success()
}

fn is_valid_json_syntax(path: &PathBuf) -> bool {
    let file_contents = std::fs::read_to_string(&path).expect("Failed to read the file");
    let json: serde_json::Value =
        serde_json::from_str(&file_contents).expect("File is not valid JSON");

    json.is_object()
}

#[tokio::test]
async fn test_create_blocksense_config_json_creates_file() {
    // Setup
    let cargo_target_tmpdir = std::env::var("CARGO_MANIFEST_DIR")
        .expect("CARGO_MANIFEST_DIR environment variable is not set");
    let temp_dir = TempDir::new_in(&cargo_target_tmpdir).expect("Failed to create temp directory");
    let dir = temp_dir.path().to_path_buf();

    // Run
    plugin::create_blocksense_config_json(&dir)
        .await
        .expect("Failed to create file");

    // Assert
    let file_to_test = dir.join("blocksense").join("config.json");
    assert!(file_to_test.exists());
    assert!(file_to_test.is_file());
}

#[tokio::test]
async fn test_create_blocksense_config_json_creates_valid_json() {
    // Setup
    let cargo_target_tmpdir = std::env::var("CARGO_MANIFEST_DIR")
        .expect("CARGO_MANIFEST_DIR environment variable is not set");
    let temp_dir = TempDir::new_in(&cargo_target_tmpdir).expect("Failed to create temp directory");
    let dir = temp_dir.path().to_path_buf();

    // Run
    plugin::create_blocksense_config_json(&dir)
        .await
        .expect("Failed to create file");

    // Assert
    let file_to_test = dir.join("blocksense").join("config.json");
    assert!(file_to_test.exists());
    assert!(file_to_test.is_file());
    let is_valid_json = is_valid_json_syntax(&file_to_test);
    assert!(is_valid_json, "File contains invalid Json syntax"); //TODO: Return serde_json output on failure
}

#[tokio::test]
async fn test_get_requirements_rs_content_creates_file() {
    // Setup
    let cargo_target_tmpdir = std::env::var("CARGO_MANIFEST_DIR")
        .expect("CARGO_MANIFEST_DIR environment variable is not set");
    let temp_dir = TempDir::new_in(&cargo_target_tmpdir).expect("Failed to create temp directory");
    let dir = temp_dir.path().to_path_buf();

    // Run
    plugin::create_src_requirements_rs(&dir)
        .await
        .expect("Failed to create file");

    // Assert
    let file_to_test = dir.join("src").join("requirements.rs");
    assert!(file_to_test.exists());
    assert!(file_to_test.is_file());
}

#[tokio::test]
async fn test_get_requirements_rs_content_creates_valid_rust_file() {
    // Setup
    let cargo_target_tmpdir = std::env::var("CARGO_MANIFEST_DIR")
        .expect("CARGO_MANIFEST_DIR environment variable is not set");
    let temp_dir = TempDir::new_in(&cargo_target_tmpdir).expect("Failed to create temp directory");
    let dir = temp_dir.path().to_path_buf();

    // Run
    plugin::create_src_requirements_rs(&dir)
        .await
        .expect("Failed to create file");

    // Assert
    let file_to_test = dir.join("src").join("requirements.rs");
    assert!(file_to_test.exists());
    assert!(file_to_test.is_file());
    let is_valid_rust = is_valid_rust_syntax(&file_to_test);
    assert!(is_valid_rust, "File contains invalid Rust syntax"); //TODO: Return rustc output on failure
}

#[tokio::test]
async fn test_update_cargo_toml_creates_valid_toml() {
    // Setup
    let cargo_target_tmpdir = std::env::var("CARGO_MANIFEST_DIR")
        .expect("CARGO_MANIFEST_DIR environment variable is not set");
    let temp_dir = TempDir::new_in(&cargo_target_tmpdir).expect("Failed to create temp directory");
    let dir = temp_dir.path().to_path_buf();
    let file_to_test = dir.join("Cargo.toml");
    fs::write(&file_to_test, "[package]\nname = \"hello_world\"\n")
        .expect("Could not create Cargo.toml");
    assert!(file_to_test.exists());
    assert!(file_to_test.is_file());

    // Run
    plugin::update_cargo_toml(&dir)
        .await
        .expect("Failed to create file");

    // Assert
    let file_to_test = dir.join("Cargo.toml");
    assert!(file_to_test.exists());
    assert!(file_to_test.is_file());

    // Check if Cargo.toml is a valid TOML file
    let contents = fs::read_to_string(&file_to_test).expect("Could not read Cargo.toml");
    let parsed: Result<toml::Value, toml::de::Error> = toml::from_str(&contents);
    assert!(parsed.is_ok(), "Cargo.toml is not valid TOML");
}

#[test]
#[ignore = "failing on git ci"]
fn test_blocksense_plugin_init_command_success() {
    // Setup
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let dir = temp_dir.path().to_path_buf();

    // Run
    let mut cmd = Command::cargo_bin("blocksense").expect("blocksense binary does not exists");
    cmd.current_dir(&dir)
        .arg("dev")
        .arg("plugin")
        .arg("init")
        .arg("test_plugin")
        .assert()
        .success();
    // Assert
}
