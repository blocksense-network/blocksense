use data_feeds::orchestrator::orchestrator;

#[tokio::main]
async fn main() {
    orchestrator().await;
}
