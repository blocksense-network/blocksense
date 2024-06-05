use tokio::{fs, io::AsyncWriteExt};

use anyhow::Result;
use clap::{Parser, Subcommand};

use crate::commands::{build::BuildConfig, oracle::OracleNodeCommands};

/// Commands for initializing blocksense projects.
#[derive(Debug, Subcommand)]
pub enum NodeCommands {
    /// Commands for working with oracle scripts.
    #[command(subcommand)]
    Oracle(OracleNodeCommands),
    /// Command for building the oracle node operator.
    Build(BuildConfig),
    /// Command for downloading the configuration needed for the oracle node operator.
    Init(Init),
    /// Command for registering the node operator.
    Register(Register),
}

impl NodeCommands {
    pub async fn run(self) -> Result<()> {
        match self {
            NodeCommands::Oracle(cmd) => cmd.run().await,
            NodeCommands::Build(cmd) => cmd.run().await,
            NodeCommands::Init(cmd) => cmd.run().await,
            NodeCommands::Register(cmd) => cmd.run().await,
        }
    }
}

#[derive(Parser, Debug)]
pub struct Init {
    /// Specifies if you directly want to build the cofiguration.
    #[arg(short = 'b')]
    // TODO(adikov): Implement
    pub build: bool,
}

impl Init {
    pub async fn run(self) -> Result<()> {
        let config = blocksense_registry::registry::Registry::get_config().await?;
        let mut file = fs::File::create("blocksense-config.json").await?;
        let json = serde_json::to_string_pretty(&config)?;
        file.write_all(json.as_bytes()).await?;
        Ok(())
    }
}

#[derive(Parser, Debug)]
pub struct Register {
    /// Specifies the node operator account
    #[arg(short = 'a')]
    pub account: Vec<String>,
}

impl Register {
    pub async fn run(self) -> Result<()> {
        unimplemented!()
    }
}
