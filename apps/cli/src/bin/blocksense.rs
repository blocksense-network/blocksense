use std::io::IsTerminal;

use anyhow::*;

use blocksense_cli::commands::{dev::DevCommands, node::NodeCommands};
use clap::Parser;
use lazy_static::lazy_static;
use utils::build_info::BuildInfo;
lazy_static! {
    pub static ref BUILD_INFO: BuildInfo = BuildInfo::default();
    pub static ref BUILD_INFO_STR: String =
        format!("{}\n{}", &BUILD_INFO.version, show_build_info());
}

/// Helper for passing VERSION to structopt.
fn version() -> &'static str {
    &BUILD_INFO.version
}

fn about() -> &'static str {
    "Blocksense network main tool"
}
fn version_long() -> &'static str {
    &BUILD_INFO_STR
}

fn show_build_info() -> String {
    let i = BuildInfo::default();
    let mut res = "--------   Build info ----------\n\n".to_owned();
    res.push_str(format!("Version         {}\n", i.version).as_str());
    res.push_str(format!("Commit          {}\n", i.git_hash).as_str());
    res.push_str(format!("Git tag         {}\n", i.git_tag).as_str());
    res.push_str(format!("Git short       {}\n", i.git_hash_short).as_str());
    res.push_str(format!("Git patches     {}\n", i.git_num_commits_since_tag).as_str());
    res.push_str(format!("Git dirty       {}\n", i.git_dirty).as_str());
    res.push_str(format!("Git branch      {}\n", i.git_branch).as_str());
    res.push_str(format!("Debug           {}\n", i.cargo_debug).as_str());
    res.push_str(format!("Features        {}\n", i.cargo_features).as_str());
    res.push_str(format!("Optimizations   {}\n", i.cargo_opt_level).as_str());
    res.push_str(format!("Host            {}\n", i.rustc_host_triple).as_str());
    res.push_str(format!("OS              {}\n", i.sysinfo_os_version).as_str());
    res.push_str(
        format!(
            "Rust compiler   {}-{} from {}\n",
            i.rustc_sem_version, i.rustc_channel, i.rustc_commit_date
        )
        .as_str(),
    );
    res.push_str(format!("LLVM            {}\n", i.rustc_llvm_version).as_str());
    res
}

/// Blocksense cli
#[derive(Debug, Parser)]
#[command(name = "blocksense", version = version(), about = about(), long_version = version_long())]
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

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_ansi(std::io::stderr().is_terminal())
        .init();

    let blocksense = BlocksenseApp::parse();
    blocksense.run().await
}
