use anyhow::*;
use blocksense_cli::build_info::*;
use blocksense_cli::commands::{dev::DevCommands, node::NodeCommands};
use clap::Parser;
use lazy_static::lazy_static;
lazy_static! {
    pub static ref VERSION: String = build_info();
}

/// Helper for passing VERSION to structopt.
fn version() -> &'static str {
    &VERSION
}

/// Blocksense cli
#[derive(Debug, Parser)]
#[command(name = "blocksense", version = version())]
enum BlocksenseApp {
    /// Interface for developing Blocksense applications.
    #[command(subcommand)]
    Dev(DevCommands),
    /// Interface for configuring node operator.
    #[command(subcommand)]
    Node(NodeCommands),
}

impl BlocksenseApp {
    pub async fn run(self) -> Result<(), Error> {
        match self {
            Self::Dev(cmd) => cmd.run().await,
            Self::Node(cmd) => cmd.run().await,
        }
    }
}
/// Returns build information, similar to: 0.1.0.
fn build_info() -> String {
    BLOCKSENSE_VERSION.to_string()
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let blocksense = BlocksenseApp::parse();
    blocksense.run().await
}
