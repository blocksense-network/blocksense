use crate::utils::eth_send_to_contract::eth_batch_send_to_all_contracts;
use crate::utils::provider::SharedRpcProviders;
use actix_web::rt::spawn;
use async_channel::Receiver;
use std::collections::HashMap;
pub struct VotesResultSender {}

impl VotesResultSender {
    pub fn new(
        batched_votes_recv: Receiver<HashMap<String, String>>,
        providers: SharedRpcProviders,
    ) -> VotesResultSender {
        spawn(async move {
            loop {
                let recvd = batched_votes_recv.recv().await;
                match recvd {
                    Ok(updates) => {
                        println!("sending updates to contract:");
                        eth_batch_send_to_all_contracts(providers.clone(), updates)
                            .await
                            .unwrap();
                        println!("Sending updates complete.");
                    }
                    Err(err) => {
                        println!("Sender got RecvError: {}", err.to_string());
                    }
                }
            }
        });
        VotesResultSender {}
    }
}
