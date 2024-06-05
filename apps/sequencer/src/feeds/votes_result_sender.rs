use crate::utils::eth_send_to_contract::eth_batch_send_to_all_contracts;
use crate::utils::provider::SharedRpcProviders;
use actix_web::rt::spawn;
use std::collections::HashMap;
use std::fmt::Debug;
use tokio::sync::mpsc::UnboundedReceiver;
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
                        println!("sending updates to contract:");
                        eth_batch_send_to_all_contracts(providers.clone(), updates)
                            .await
                            .unwrap();
                        println!("Sending updates complete.");
                    }
                    None => {
                        println!("Sender got RecvError");
                    }
                }
            }
        });
        VotesResultSender {}
    }
}
