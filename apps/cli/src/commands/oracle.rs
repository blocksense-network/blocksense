use std::path::PathBuf;
use std::process::Stdio;
use std::{env, fs};

use anyhow::Result;

use blocksense_registry::config::get_blocksense_config_dummy;
use clap::{Parser, Subcommand};
use tokio::process::Command;
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
            .arg("http-rust")
            .stdin(Stdio::inherit())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()?;

        let status = child.wait().await?;

        if !status.success() {
            error!("`spin new` command failed with status: {}", status);
            return Err(anyhow::anyhow!("spin new command failed"));
        }
        let entries = fs::read_dir(&current_dir)?;

        let newest_dir = entries
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false))
            .max_by_key(|entry| entry.metadata().unwrap().modified().unwrap());

        if let Some(dir_entry) = newest_dir {
            let dir_path = dir_entry.path();
            let blocksense_config_path = dir_path.join("blocksense-config.json");

            // Create and write to the config file
            let config_json = serde_json::to_string_pretty(&get_blocksense_config_dummy())?;
            fs::write(&blocksense_config_path, config_json)?;

            println!(
                "Dummy BlocksenseConfig generated at: {:?}",
                blocksense_config_path
            );
        } else {
            error!("No new directory was created");
        }

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
