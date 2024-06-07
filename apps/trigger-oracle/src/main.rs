use anyhow::Error;
use clap::Parser;
use spin_trigger::cli::TriggerExecutorCommand;
use std::io::IsTerminal;
use trigger_oracle::OracleTrigger;

type Command = TriggerExecutorCommand<OracleTrigger>;

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_ansi(std::io::stderr().is_terminal())
        .init();

    let t = Command::parse();
    t.run().await
}
