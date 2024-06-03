use std::path::PathBuf;
use std::process::Stdio;

use anyhow::Result;

use clap::{Parser, Subcommand};
use tokio::process::Command;

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
        Command::new("spin")
            .arg("new")
            .arg("-t")
            .arg("oracle-rust")
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()?
            .wait()
            .await?;

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
