use crate::providers::eth_send_utils::eth_batch_send_to_all_contracts;
use crate::sequencer_state::SequencerState;
use actix_web::rt::spawn;
use actix_web::web::Data;
use feed_registry::types::Repeatability::Periodic;
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
    sequencer_state: Data<SequencerState>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    spawn(async move {
        loop {
            let recvd = batched_votes_recv.recv().await;
            match recvd {
                Some(updates) => {
                    info!("sending updates to contract:");
                    let sequencer_state = sequencer_state.clone();
                    spawn(async move {
                        match eth_batch_send_to_all_contracts(sequencer_state, updates, Periodic)
                            .await
                        {
                            Ok(res) => info!("Sending updates complete {}.", res),
                            Err(err) => error!("ERROR Sending updates {}", err),
                        };
                    });
                }
                None => {
                    error!("Sender got RecvError");
                }
            }
        }
    })
}
