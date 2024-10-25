use crate::providers::eth_send_utils::eth_batch_send_to_all_contracts;
use crate::{sequencer_state::SequencerState, UpdateToSend};
use actix_web::web::Data;
use feed_registry::types::Repeatability::Periodic;
use std::fmt::Debug;
use std::io::Error;
use tokio::sync::mpsc::UnboundedReceiver;
use tracing::{error, info};

pub async fn votes_result_sender_loop<
    K: Debug + Clone + std::string::ToString + 'static,
    V: Debug + Clone + std::string::ToString + 'static,
>(
    mut batched_votes_recv: UnboundedReceiver<UpdateToSend<K, V>>,
    sequencer_state: Data<SequencerState>,
) -> tokio::task::JoinHandle<Result<(), Error>> {
    tokio::task::Builder::new()
        .name("votes_result_sender")
        .spawn_local(async move {
            let mut batch_count = 0;
            loop {
                let recvd = batched_votes_recv.recv().await;
                match recvd {
                    Some(updates) => {
                        info!("sending updates to contract:");
                        let sequencer_state = sequencer_state.clone();
                        async_send_to_contracts(sequencer_state, updates, batch_count);
                    }
                    None => {
                        error!("Sender got RecvError");
                    }
                }
                batch_count += 1;
                if batch_count >= 1000000 {
                    batch_count = 0;
                }
            }
        })
        .expect("Failed to spawn votes result sender!")
}

fn async_send_to_contracts<
    K: Debug + Clone + std::string::ToString + 'static,
    V: Debug + Clone + std::string::ToString + 'static,
>(
    sequencer_state: Data<SequencerState>,
    updates: UpdateToSend<K, V>,
    batch_count: usize,
) {
    let sender = tokio::task::Builder::new()
        .name(format!("batch_sender_{batch_count}").as_str())
        .spawn_local(async move {
            match eth_batch_send_to_all_contracts(sequencer_state, updates.kv_updates, Periodic)
                .await
            {
                Ok(res) => info!("Sending updates complete {}.", res),
                Err(err) => error!("ERROR Sending updates {}", err),
            };
        });
    if let Err(err) = sender {
        error!("Failed to spawn batch sender {batch_count} due to {err}!");
    }
}
