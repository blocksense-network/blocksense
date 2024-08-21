use data_feeds::orchestrator::orchestrator;

#[tokio::main]
async fn main() {
    // This trigger spawns threads, which Ctrl+C does not kill.  So
    // for this case we need to detect Ctrl+C and shut those threads
    // down.  For simplicity, we do this by terminating the process.
    tokio::spawn(async move {
        tokio::signal::ctrl_c().await.unwrap();
        std::process::exit(0);
    });

    orchestrator().await;
}
