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
    /// Specifies entities to add
    #[arg(short = 'o')]
    pub oracles: Vec<String>,
}

impl Init {
    pub async fn run(self) -> Result<()> {
        let _config = blocksense_registry::registry::Registry::get_config().await?;
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
