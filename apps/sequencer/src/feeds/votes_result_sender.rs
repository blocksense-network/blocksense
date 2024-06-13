use crate::providers::eth_send_utils::eth_batch_send_to_all_contracts;
use crate::providers::provider::SharedRpcProviders;
use actix_web::rt::spawn;
use std::collections::HashMap;
use std::fmt::Debug;
use std::io::Error;
use tokio::sync::mpsc::UnboundedReceiver;
use tracing::{error, info};

pub async fn votes_result_sender_loop<
    K: Debug + Clone + std::string::ToString + 'static,
    V: Debug + Clone + std::string::ToString + 'static,
>(
    mut batched_votes_recv: UnboundedReceiver<HashMap<K, V>>,
    providers: SharedRpcProviders,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    spawn(async move {
        loop {
            let recvd = batched_votes_recv.recv().await;
            match recvd {
                Some(updates) => {
                    info!("sending updates to contract:");
                    eth_batch_send_to_all_contracts(providers.clone(), updates)
                        .await
                        .unwrap();
                    info!("Sending updates complete.");
                }
                None => {
                    error!("Sender got RecvError");
                }
            }
        }
    })
}
