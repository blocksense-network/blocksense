use crate::utils::eth_send_utils::eth_batch_send_to_all_contracts;
use crate::utils::provider::SharedRpcProviders;
use actix_web::rt::spawn;
use std::collections::HashMap;
use std::fmt::Debug;
use tokio::sync::mpsc::UnboundedReceiver;
use tracing::{error, info};

pub struct VotesResultSender {}

impl VotesResultSender {
    pub fn new<
        K: Debug + Clone + std::string::ToString + 'static,
        V: Debug + Clone + std::string::ToString + 'static,
    >(
        mut batched_votes_recv: UnboundedReceiver<HashMap<K, V>>,
        providers: SharedRpcProviders,
    ) -> VotesResultSender {
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
        });
        VotesResultSender {}
    }
}
