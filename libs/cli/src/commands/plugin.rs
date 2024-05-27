use clap::{Args, Subcommand};
use serde::Serialize;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::process;
use std::process::Command;
use std::{env, fs, io};

use proc_macro2::TokenStream;
use quote::quote;

#[derive(Debug, Subcommand)]
pub enum PluginCommands {
    /// Initialize a new plugin development directory
    Init(PluginInitArgs),
}

impl PluginCommands {
    pub async fn run(self) -> anyhow::Result<()> {
        match self {
            PluginCommands::Init(args) => args.run().await,
        }
    }
}

#[derive(Debug, Args)]
pub struct PluginInitArgs {
    /// Name of the plugin
    name: String,
}

impl PluginInitArgs {
    pub async fn run(self) -> anyhow::Result<()> {
        process_plugin_init_command(&self.name);
        Ok(())
    }
}

fn process_plugin_init_command(plugin_name: &str) {
    // cargo component new --lib <name>
    run_cargo_component_new(plugin_name);

    let current_dir = match env::current_dir() {
        Ok(path) => path,
        Err(e) => {
            eprintln!("Could not get current directory {}", e);
            process::exit(1);
        }
    };
    let plugin_dir = current_dir.join(plugin_name);

    // Create blocksense/config.json
    create_blocksense_config_json(&plugin_dir);

    // Update Cargo.toml
    update_cargo_toml(&plugin_dir);

    // Create src/plugin_requirements.rs
    create_src_requirements_rs(&plugin_dir);

    ()
}

fn run_cargo_component_new(name: &str) {
    println!("Initializing directory {}", name);
    // TODO: Validate current dir is not cargo workspace
    let output = Command::new("cargo")
        .arg("component")
        .arg("new")
        .arg("--lib")
        .arg(name)
        .output()
        .expect("failed to execute process");

    if !output.status.success() {
        io::stderr().write_all(&output.stderr).unwrap();
        std::process::exit(1);
    }
}

pub fn create_blocksense_config_json(plugin_dir: &PathBuf) {
    let config_dir = plugin_dir.join("blocksense");
    let config_file_path = config_dir.join("config.json");
    let config_file_content = get_default_config_json_content();

    println!("Creating {:?}", config_file_path);

    if let Err(e) = fs::create_dir(&config_dir) {
        if e.kind() != io::ErrorKind::AlreadyExists {
            eprintln!("Failed to create directory {}:", e);
            process::exit(1);
        }
    }

    if let Err(e) = fs::write(&config_file_path, config_file_content) {
        eprintln!("Failed to create file {}:", e);
        process::exit(1);
    }
}

fn get_default_config_json_content() -> String {
    #[derive(Serialize)]
    struct Config {
        namespace: String,
        name: String,
        id: String,
        requirements: Vec<Requirement>,
    }

    #[derive(Serialize)]
    struct Requirement {
        #[serde(rename = "type")]
        req_type: String,
        domain: String,
        env_var: String,
    }

    let config = Config {
        namespace: "plugin_namespace".to_string(),
        name: "plugin_name".to_string(),
        id: "plugin_id".to_string(),
        requirements: vec![Requirement {
            req_type: "apikey".to_string(),
            domain: "localhost".to_string(),
            env_var: "BLOCKSENSE_APIKEY_LOCALHOST".to_string(),
        }],
    };

    let content = match serde_json::to_string_pretty(&config) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to serialize config: {}", e);
            process::exit(1);
        }
    };
    return content;
}

// fn get_default_config_json_content() -> String {
//     let config_json_content = String::from("
//      {
//         \"namespace\": \"plugin_namespace\",
//         \"name\": \"plugin_name\",
//         \"id\": \"plugin_id\",
//         \"requirements\": [
//             {
//                 \"type\": \"apikey\",
//                 \"domain\": \"localhost\",
//                 \"env_var\": \"BLOCKSENSE_APIKEY_LOCALHOST\",
//             }
//         ]
//      }
// ");
// return config_json_content;
// }

fn update_cargo_toml(plugin_dir: &PathBuf) {
    let cargo_toml_file = plugin_dir.join("Cargo.toml");
    println!("Updating {:?}", cargo_toml_file);

    let new_lines = r#"[package.metadata.component.target.dependencies]
"component:apikeydep" = { path = "../../blocksense-node/dep_comps/apikeydep/wit/" }

[workspace]
"#;

    if let Err(e) = append_to_cargo_toml(&cargo_toml_file, new_lines) {
        eprintln!("Error updating file: {}", e);
        process::exit(1);
    }
}

fn append_to_cargo_toml(file_path: &PathBuf, content: &str) -> io::Result<()> {
    let mut file = OpenOptions::new().append(true).open(file_path)?;
    writeln!(file, "\n{}", content)?;
    Ok(())
}

pub fn create_src_requirements_rs(plugin_dir: &PathBuf) {
    let src_dir = plugin_dir.join("src");
    let requirements_rs_file_path = src_dir.join("requirements.rs");
    let requirements_file_content = get_requirements_rs_content();

    if let Err(e) = fs::create_dir_all(&src_dir) {
        if e.kind() != io::ErrorKind::AlreadyExists {
            eprintln!("Failed to create directory {}:", e);
            process::exit(1);
        }
    }

    println!("Creating {:?}", requirements_rs_file_path);

    if let Err(e) = fs::write(&requirements_rs_file_path, requirements_file_content) {
        eprintln!("Error writing to file: {}", e);
        process::exit(1);
    }
}

fn get_requirements_rs_content() -> String {
    let config_json_content = String::from(
        "
    pub fn get_api_key() -> String {
        let api_key = std::env::var(\"BLOCKSENSE_APIKEY_LOCALHOST\")
            .expect(\"Environment variable BLOCKSENSE_APIKEY_LOCALHOST must be set\");
        if api_key.is_empty() {
            panic!(\"Environment variable BLOCKSENSE_APIKEY_LOCALHOST is set but empty\");
        }
        api_key
    }",
    );
    return config_json_content;
}

fn get_requirements_rs_content_v2() -> String {
    let content: TokenStream = quote! {
        mod plugin_requirements;

        pub fn get_api_key() -> String {
            let api_key = env::var("BLOCKSENSE_APIKEY_LOCALHOST")
                .expect("Environment variable BLOCKSENSE_APIKEY_LOCALHOST must be set");

            if api_key.is_empty() {
                panic!("Environment variable BLOCKSENSE_APIKEY_LOCALHOST is set but empty");
            }

            api_key
        }
    };
    content.to_string()
}

/*
#[cfg(test)]
mod tests {

    use std::path::PathBuf;
    use std::sync::Once;
    use once_cell::sync::Lazy;
    use tempfile::TempDir;

    // This will hold the path to the temporary directory for the tests.
    static TEMP_DIR: Lazy<PathBuf> = Lazy::new(|| {
        static INIT: Once = Once::new();
        let mut temp_dir_path = PathBuf::new();

        INIT.call_once(|| {
            let cargo_target_tmpdir = std::env::var("CARGO_TARGET_TMPDIR")
                .expect("CARGO_TARGET_TMPDIR environment variable is not set");
            let temp_dir = TempDir::new_in(&cargo_target_tmpdir)
                .expect("Failed to create temp directory");
            temp_dir_path = temp_dir.path().to_path_buf();
            std::mem::forget(temp_dir);
        });

        temp_dir_path
    });

    fn is_valid_rust_syntax(path: &PathBuf) -> bool {
        let output = std::process::Command::new("rustc")
            .arg("--check")
            .arg(path)
            .output()
            .expect("Failed to execute rustc");

        output.status.success()
    }

    fn is_valid_json_syntax(path: &PathBuf) -> bool {
        let file_contents = std::fs::read_to_string(&path).expect("Failed to read the file");
        let json: serde_json::Value = serde_json::from_str(&file_contents).expect("File is not valid JSON");

        json.is_object()
    }

    #[test]
    fn test_create_blocksense_config_json_creates_file() {
        let dir = TEMP_DIR.clone();
        super::create_blocksense_config_json(&dir);
        let file_to_test = dir.join("blocksense").join("config.json");
        assert!(file_to_test.exists());
        assert!(file_to_test.is_file());
    }

    #[test]
    fn test_create_blocksense_config_json_creates_valid_json() {
        let dir = TEMP_DIR.clone();
        super::create_blocksense_config_json(&dir);
        let file_to_test = dir.join("blocksense").join("config.json");
        assert!(file_to_test.exists());
        assert!(file_to_test.is_file());

        // let file_contents = std::fs::read_to_string(&file_to_test).expect("Failed to read the file");
        // let json: serde_json::Value = serde_json::from_str(&file_contents).expect("File is not valid JSON");

        // assert!(json.is_object());
        let is_valid_json = is_valid_json_syntax(&file_to_test);
        assert!(is_valid_json, "File contains invalid Json syntax"); //TODO: Return serde_json output on failure
    }

    #[test]
    fn test_get_requirements_rs_content_creates_file() {
        let dir = TEMP_DIR.clone();
        super::create_src_requirements_rs(&dir);
        let file_to_test = dir.join("src").join("requirements.rs");
        assert!(file_to_test.exists());
        assert!(file_to_test.is_file());
    }

    #[test]
    fn test_get_requirements_rs_content_creates_valid_rust_file() {
        let dir = TEMP_DIR.clone();
        super::create_src_requirements_rs(&dir);
        let file_to_test = dir.join("src").join("requirements.rs");
        assert!(file_to_test.exists());
        assert!(file_to_test.is_file());

        let is_valid_rust = is_valid_rust_syntax(&file_to_test);

        assert!(is_valid_rust, "File contains invalid Rust syntax"); //TODO: Return rustc output on failure
    }
}
 */
