use actix_web::rt::spawn;
use data_feeds::orchestrator::orchestrator;
use prometheus::actix_server::run_actix_server;

#[actix_web::main]
async fn main() {
    // This trigger spawns threads, which Ctrl+C does not kill.  So
    // for this case we need to detect Ctrl+C and shut those threads
    // down.  For simplicity, we do this by terminating the process.
    tokio::spawn(async move {
        tokio::signal::ctrl_c().await.unwrap();
        std::process::exit(0);
    });

    spawn(async move { run_actix_server().await });

    orchestrator().await;
}
