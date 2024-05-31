use actix_web::rt::spawn;
use async_channel::{Receiver, Sender};
use std::collections::HashMap;
use std::env;
use std::fmt::Debug;
use tokio::time::Duration;

pub struct VotesResultBatcher {}

impl VotesResultBatcher {
    pub fn new<
        K: Debug
            + Clone
            + std::string::ToString
            + 'static
            + std::cmp::Eq
            + PartialEq
            + std::hash::Hash,
        V: Debug + Clone + std::string::ToString + 'static,
    >(
        vote_recv: Receiver<(K, V)>,
        batched_votes_send: Sender<HashMap<K, V>>,
    ) -> VotesResultBatcher {
        spawn(async move {
            let batch_size_env = "SEQUENCER_MAX_KEYS_TO_BATCH";
            let max_keys_to_batch = match env::var(batch_size_env) {
                Ok(batch_size) => batch_size
                    .parse::<usize>()
                    .expect(format!("{} should be an unsigned integer.", batch_size_env).as_str()),
                Err(_) => 1,
            };
            println!(
                "VotesResultBatcher: max_keys_to_batch set to {}",
                max_keys_to_batch
            );
            let duration_env = "SEQUENCER_KEYS_BATCH_DURATION";
            let timeout_duration = match env::var(duration_env) {
                Ok(duration_env) => duration_env.parse::<u64>().expect(
                    format!(
                        "{} should be an unsigned integer in milliseconds.",
                        duration_env
                    )
                    .as_str(),
                ),
                Err(_) => 500,
            };
            println!(
                "VotesResultBatcher: timeout_duration set to {}",
                timeout_duration
            );

            loop {
                let mut updates: HashMap<K, V> = Default::default();
                let mut send_to_contract = false;
                while !send_to_contract {
                    let var: Result<Result<(_, _), _>, tokio::time::error::Elapsed> =
                        actix_web::rt::time::timeout(
                            Duration::from_millis(timeout_duration),
                            async { vote_recv.recv().await },
                        )
                        .await;
                    match var {
                        Ok(Ok((key, val))) => {
                            println!("adding {:?} => {:?} to updates", key, val);
                            updates.insert(key, val);
                            send_to_contract = updates.keys().len() >= max_keys_to_batch;
                        }
                        Err(e) => {
                            println!("Flushing batched updates, {}", e.to_string());
                            send_to_contract = true;
                        }
                        Ok(Err(err)) => {
                            println!("Batcher got RecvError: {}", err.to_string());
                            send_to_contract = true;
                        }
                    };
                }
                if updates.keys().len() > 0 {
                    batched_votes_send.send(updates).await.unwrap();
                }
            }
        });
        VotesResultBatcher {}
    }
}
