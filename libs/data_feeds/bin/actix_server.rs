use prometheus::actix_server::run_actix_server;

#[tokio::main]
async fn main() -> std::io::Result<()> {
    run_actix_server().await
}
