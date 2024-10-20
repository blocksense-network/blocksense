use std::path::PathBuf;
use std::process::Stdio;
use std::{env, fs};

use anyhow::Result;

use blocksense_registry::config::get_blocksense_config_dummy;
use clap::{Parser, Subcommand};
use tokio::io::{AsyncBufReadExt, BufReader, BufWriter};
use tokio::{fs::File, process::Command};
use tracing::error;

/// Commands for working with the capabilities.
#[derive(Debug, Subcommand)]
pub enum OracleNodeCommands {
    /// Add an oracle script
    Add(Add),
    /// List oracle scripts.
    List(List),
    /// Remove an oracle script.
    Remove(Remove),
}

impl OracleNodeCommands {
    pub async fn run(self) -> Result<()> {
        match self {
            OracleNodeCommands::Add(cmd) => cmd.run().await,
            OracleNodeCommands::List(cmd) => cmd.run().await,
            OracleNodeCommands::Remove(cmd) => cmd.run().await,
        }
    }
}

/// Commands for working with the capabilities.
#[derive(Debug, Subcommand)]
pub enum OracleDevCommands {
    /// Add an oracle script
    Init(Init),
    /// List oracle scripts.
    Publish(Publish),
    /// Remove an oracle script.
    Retire(Retire),
}

impl OracleDevCommands {
    pub async fn run(self) -> Result<()> {
        match self {
            OracleDevCommands::Init(cmd) => cmd.run().await,
            OracleDevCommands::Publish(cmd) => cmd.run().await,
            OracleDevCommands::Retire(cmd) => cmd.run().await,
        }
    }
}

#[derive(Parser, Debug)]
pub struct Add {
    /// Specifies entities to add
    #[arg(short = 'o')]
    pub oracles: Vec<String>,
}

impl Add {
    pub async fn run(self) -> Result<()> {
        unimplemented!()
    }
}

#[derive(Parser, Debug)]
pub struct List {
    /// Specifies entities to list
    #[arg(short = 'o')]
    pub oracles: Option<Vec<String>>,
}

impl List {
    pub async fn run(self) -> Result<()> {
        unimplemented!()
    }
}

#[derive(Parser, Debug)]
pub struct Remove {
    /// Specifies the path to the entity.
    #[arg(short = 'd')]
    pub oracle_dir: PathBuf,
}

impl Remove {
    pub async fn run(self) -> Result<()> {
        unimplemented!()
    }
}

#[derive(Parser, Debug)]
pub struct Init {
    /// Specifies which template to use
    #[clap(short = 't')]
    pub template: Option<String>,
}

impl Init {
    pub async fn run(self) -> Result<()> {
        let current_dir = env::current_dir()?;

        let mut child = Command::new("spin")
            .arg("new")
            .arg("-t")
            // .arg("oracle-rust") //TODO(snikolov): There is no template oracle-rust
            .arg("http-rust")
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()?;

        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            // First line of the `spin new` command is the name of the spin component and its' folder
            if let Ok(Some(relative_directory)) = lines.next_line().await {
                let dir_path = current_dir.join(&relative_directory);
                if dir_path.exists() {
                    let blocksense_config_path = dir_path.join("blocksense-config.json");

                    // Create and write to the temp file
                    let mut config_file = File::create(&blocksense_config_path).await?;
                    let config_json = serde_json::to_string_pretty(&get_blocksense_config_dummy())?;

                    fs::write(&blocksense_config_path, config_json)?;

                    println!(
                        "Dummy BlocksenseConfig generated at: {:?}",
                        blocksense_config_path
                    );
                } else {
                    error!("Directory does not exist: {}", relative_directory);
                }
            }
        }

        let status = child.wait().await?;

        Ok(())
    }
}

#[derive(Parser, Debug)]
pub struct Publish {
    /// Specifies the path to the entity.
    #[arg(short = 'd')]
    pub oracle_dir: PathBuf,
}

impl Publish {
    pub async fn run(self) -> Result<()> {
        unimplemented!()
    }
}

#[derive(Parser, Debug)]
pub struct Retire {
    /// Specifies the path to the entity.
    #[arg(short = 'o')]
    pub oracle_id: String,
}

impl Retire {
    pub async fn run(self) -> Result<()> {
        unimplemented!()
    }
}
