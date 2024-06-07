use anyhow::Result;
use clap::Subcommand;

use crate::commands::oracle::OracleDevCommands;

/// Commands for initializing blocksense projects.
#[derive(Debug, Subcommand)]
pub enum DevCommands {
    /// Commands for working with capabilities.
    #[command(subcommand)]
    Oracle(OracleDevCommands),
}

impl DevCommands {
    pub async fn run(self) -> Result<()> {
        match self {
            DevCommands::Oracle(cmd) => cmd.run().await,
        }
    }
}
