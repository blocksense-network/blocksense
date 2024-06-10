use anyhow::{Context, Result};
use clap::{Args, Subcommand};
use serde::Serialize;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::{env, fs, io};

#[derive(Debug, Subcommand)]
pub enum PluginCommands {
    /// Initialize a new plugin development directory
    Init(PluginInitArgs),
}

impl PluginCommands {
    pub async fn run(self) -> Result<()> {
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
    pub async fn run(self) -> Result<()> {
        if let Err(e) = process_plugin_init_command(&self.name) {
            eprintln!("Error: {}", e);
            Err(e)
        } else {
            Ok(())
        }
    }
}

fn process_plugin_init_command(plugin_name: &str) -> Result<()> {
    // cargo component new --lib <name>
    run_cargo_component_new(plugin_name)?;

    let current_dir = env::current_dir().context("Could not get current directory")?;
    let plugin_dir = current_dir.join(plugin_name);
    // Create blocksense/config.json
    create_blocksense_config_json(&plugin_dir)?;

    // Update Cargo.toml
    update_cargo_toml(&plugin_dir)?;

    // Create src/plugin_requirements.rs
    create_src_requirements_rs(&plugin_dir)?;
    Ok(())
}

fn run_cargo_component_new(name: &str) -> Result<()> {
    println!("Initializing directory {}", name);
    // TODO: Validate current dir is not cargo workspace
    let output = Command::new("cargo")
        .arg("component")
        .arg("new")
        .arg("--lib")
        .arg(name)
        .output()
        .context("failed to execute process")?;

    if !output.status.success() {
        io::stderr()
            .write_all(&output.stderr)
            .context("Failed to write to stderr")?;
        return Err(anyhow::anyhow!("cargo component new command failed"));
    }

    Ok(())
}

pub fn create_blocksense_config_json(plugin_dir: &PathBuf) -> Result<()> {
    let config_dir = plugin_dir.join("blocksense");
    let config_file_path = config_dir.join("config.json");
    let config_file_content = get_default_config_json_content();

    println!("Creating {:?}", config_file_path);

    if let Err(e) = fs::create_dir(&config_dir) {
        if e.kind() != io::ErrorKind::AlreadyExists {
            eprintln!("Failed to create directory {}:", e);
            return Err(anyhow::anyhow!("Failed to create directory: {}", e));
        }
    }

    fs::write(&config_file_path, config_file_content).context("Failed to create file")?;

    Ok(())
}

fn get_default_config_json_content() -> String {
    // TODO: moving this configuration structs into another registry crate
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
            std::process::exit(1);
        }
    };
    content
}

pub fn update_cargo_toml(plugin_dir: &PathBuf) -> Result<()> {
    let cargo_toml_file = plugin_dir.join("Cargo.toml");
    println!("Updating {:?}", cargo_toml_file);

    let new_lines = r#"[package.metadata.component.target.dependencies]
"component:apikeydep" = { path = "../../blocksense-node/dep_comps/apikeydep/wit/" }

[workspace]
"#;

    if let Err(e) = append_to_cargo_toml(&cargo_toml_file, new_lines) {
        eprintln!("Error updating file: {}", e);
        return Err(anyhow::anyhow!("Error updating file: {}", e));
    }

    Ok(())
}

fn append_to_cargo_toml(file_path: &PathBuf, content: &str) -> io::Result<()> {
    let mut file = OpenOptions::new().append(true).open(file_path)?;
    writeln!(file, "\n{}", content)?;
    Ok(())
}

pub fn create_src_requirements_rs(plugin_dir: &PathBuf) -> Result<()> {
    let src_dir = plugin_dir.join("src");
    let requirements_rs_file_path = src_dir.join("requirements.rs");
    let requirements_file_content = get_requirements_rs_content();

    if let Err(e) = fs::create_dir_all(&src_dir) {
        if e.kind() != io::ErrorKind::AlreadyExists {
            eprintln!("Failed to create directory {}:", e);
            return Err(anyhow::anyhow!("Failed to create directory: {}", e));
        }
    }

    println!("Creating {:?}", requirements_rs_file_path);

    fs::write(&requirements_rs_file_path, requirements_file_content)
        .context("Error writing to file")?;

    Ok(())
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
    config_json_content
}
