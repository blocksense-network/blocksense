use clap::Args;
use crypto::JsonSerializableSignature;
use data_feeds::connector::post::generate_signature;
use feed_registry::types::{DataFeedPayload, FeedResult, FeedType, PayloadMetaData};
use serde::{Deserialize, Serialize};
use spin_app::MetadataKey;
use spin_core::{async_trait, InstancePre};
use spin_trigger::{TriggerAppEngine, TriggerExecutor};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync::mpsc::{channel, Receiver, Sender};

const SECRET_KEY: &str = "536d1f9d97166eba5ff0efb8cc8dbeb856fb13d2d126ed1efc761e9955014003";

wasmtime::component::bindgen!({
    path: "../wit",
    world: "blocksense-oracle",
    async: true
});

use blocksense::oracle::oracle_types as oracle;

pub(crate) type RuntimeData = ();
pub(crate) type _Store = spin_core::Store<RuntimeData>;

#[derive(Args)]
pub struct CliArgs {
    /// If true, run each component once and exit
    #[clap(long)]
    pub test: bool,
    ///// IP address of the sequencer
    // #[clap(long = "sequencer-address", default_value = "127.0.0.1:3000", value_parser = parse_listen_addr)]
    // pub sequencer_address: SocketAddr,
}

// The trigger structure with all values processed and ready
pub struct OracleTrigger {
    engine: TriggerAppEngine<Self>,
    sequencer: String,
    queue_components: HashMap<String, Component>,
}

// Picks out the timer entry from the application-level trigger settings
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
struct TriggerMetadataParent {
    settings: Option<TriggerMetadata>,
}

// Application-level settings (raw serialization format)
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct TriggerMetadata {
    sequencer: Option<String>,
}

// Per-component settings (raw serialization format)
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct OracleTriggerConfig {
    component: String,
    interval_secs: u64,
    data_feed: String,
}

#[derive(Clone, Debug)]
struct Component {
    pub id: String,
    pub data_feed: String,
    pub idle_wait: tokio::time::Duration,
    pub oracle_settings: oracle::Settings,
}

// This is a placeholder - we don't yet detect any situations that would require
// graceful or ungraceful exit.  It will likely require rework when we do.  It
// is here so that we have a skeleton for returning errors that doesn't expose
// us to thoughtlessly "?"-ing away an Err case and creating a situation where a
// transient failure could end the trigger.
#[allow(dead_code)]
#[derive(Debug)]
enum TerminationReason {
    ExitRequested,
    SequencerExitRequested,
    Other(String),
}

const TRIGGER_METADATA_KEY: MetadataKey<TriggerMetadataParent> = MetadataKey::new("triggers");

#[async_trait]
impl TriggerExecutor for OracleTrigger {
    const TRIGGER_TYPE: &'static str = "oracle";

    type RuntimeData = RuntimeData;

    type TriggerConfig = OracleTriggerConfig;

    type RunConfig = CliArgs;

    type InstancePre = InstancePre<RuntimeData>;

    async fn new(engine: spin_trigger::TriggerAppEngine<Self>) -> anyhow::Result<Self> {
        let sequencer = engine
            .app()
            .require_metadata(TRIGGER_METADATA_KEY)?
            .settings
            .unwrap_or_default()
            .sequencer
            .expect("Sequencer URL is not provided");

        // TODO(adikov) There is a specific case in which one reporter receives task to report multiple
        // data feeds which are gathered from one wasm component. For example -
        // USD/BTC and USD/ETH. In that case we need to optimize calling the component once and
        // returning results for both data feeds.
        let queue_components = engine
            .trigger_configs()
            .map(|(_, config)| {
                (
                    config.data_feed.clone(),
                    Component {
                        id: config.component.clone(),
                        data_feed: config.data_feed.clone(),
                        idle_wait: tokio::time::Duration::from_secs(config.interval_secs),
                        oracle_settings: oracle::Settings {
                            id: config.data_feed.clone(),
                        },
                    },
                )
            })
            .collect();

        tracing::info!("Oracle Trigger initialized: {}", &engine.app_name);

        Ok(Self {
            engine,
            sequencer,
            queue_components,
        })
    }

    async fn run(self, config: Self::RunConfig) -> anyhow::Result<()> {
        let engine = Arc::new(self.engine);
        if config.test {
            for component in self.queue_components.values() {
                Self::execute_wasm(engine.clone(), component).await?;
            }
            return Ok(());
        }
        // This trigger spawns threads, which Ctrl+C does not kill.  So
        // for this case we need to detect Ctrl+C and shut those threads
        // down.  For simplicity, we do this by terminating the process.
        tokio::spawn(async move {
            tokio::signal::ctrl_c().await.unwrap();
            std::process::exit(0);
        });

        tracing::info!("Sequencer URL provided: {}", &self.sequencer);
        let (tx, rx) = channel(32);
        //TODO(adikov): Move all the logic to a different struct and handle
        //errors properly.
        // For each component, run its own timer loop
        let mut loops: Vec<_> = self
            .queue_components
            .into_values()
            .map(|component| Self::start_oracle_loop(engine.clone(), tx.clone(), &component))
            .collect();

        let manager = Self::start_manager(rx, &self.sequencer);
        loops.push(manager);

        let (tr, _, rest) = futures::future::select_all(loops).await;

        drop(rest);
        match tr {
            Ok(TerminationReason::ExitRequested) => {
                tracing::trace!("Exiting");
                Ok(())
            }
            _ => {
                tracing::trace!("Fatal: {:?}", tr);
                Err(anyhow::anyhow!("{tr:?}"))
            }
        }
    }
}

impl OracleTrigger {
    fn start_oracle_loop(
        engine: Arc<TriggerAppEngine<Self>>,
        thread_tx: Sender<(String, Payload)>,
        component: &Component,
    ) -> tokio::task::JoinHandle<TerminationReason> {
        let future = Self::execute(engine, thread_tx, component.clone());
        tokio::task::spawn(future)
    }

    async fn execute(
        engine: Arc<TriggerAppEngine<Self>>,
        thread_tx: Sender<(String, Payload)>,
        component: Component,
    ) -> TerminationReason {
        loop {
            tokio::time::sleep(component.idle_wait).await;
            let payload = match Self::execute_wasm(engine.clone(), &component).await {
                Ok(payload) => payload,
                Err(_error) => {
                    //TODO(adikov): We need to come up with proper way of handling errors in wasm
                    //components.
                    continue;
                }
            };
            match thread_tx.send((component.data_feed.clone(), payload)).await {
                Ok(_) => {
                    continue;
                }
                Err(_) => {
                    break;
                }
            };
        }

        TerminationReason::Other("Oracle execution loop terminated".to_string())
    }

    fn start_manager(
        rx: Receiver<(String, Payload)>,
        sequencer: &str,
    ) -> tokio::task::JoinHandle<TerminationReason> {
        let future = Self::process_payload(rx, sequencer.to_owned());

        tokio::task::spawn(future)
    }

    async fn process_payload(
        mut rx: Receiver<(String, Payload)>,
        sequencer: String,
    ) -> TerminationReason {
        while let Some((feed_id, payload)) = rx.recv().await {
            let timestamp = current_unix_time();
            let result = FeedResult::Result {
                result: FeedType::Numerical(payload.body.unwrap() as f64),
            };

            let signature =
                generate_signature(SECRET_KEY, feed_id.as_str(), timestamp, &result).unwrap();
            let payload_json = DataFeedPayload {
                payload_metadata: PayloadMetaData {
                    reporter_id: 1,
                    feed_id,
                    timestamp,
                    signature: JsonSerializableSignature { sig: signature },
                },
                result,
            };

            let client = reqwest::Client::new();
            match client
                .post(sequencer.clone())
                .json(&payload_json)
                .send()
                .await
            {
                Ok(res) => {
                    let contents = res.text().await.unwrap();
                    tracing::trace!("Sequencer responded with: {}", &contents);
                }
                Err(e) => {
                    tracing::error!("Sequencer failed to respond with: {}", &e);
                    break;
                }
            };
        }

        TerminationReason::SequencerExitRequested
    }

    async fn execute_wasm(
        engine: Arc<TriggerAppEngine<Self>>,
        component: &Component,
    ) -> anyhow::Result<Payload> {
        // Load the guest...
        let component_id = component.id.clone();
        let (instance, mut store) = engine.prepare_instance(&component_id).await?;
        let instance = BlocksenseOracle::new(&mut store, &instance)?;
        // ...and call the entry point
        tracing::trace!(
            "Triggering application: {}; component_id: {}; data_feed: {}",
            &engine.app_name,
            component_id,
            &component.data_feed
        );
        match instance
            .call_handle_oracle_request(&mut store, &component.oracle_settings)
            .await
        {
            Ok(Ok(payload)) => {
                tracing::info!("Component {component_id} completed okay");
                Ok(payload)
            }
            Ok(Err(e)) => {
                tracing::warn!("Component {component_id} returned error {:?}", e);
                Err(anyhow::anyhow!("Component {component_id} returned error")) // TODO: more details when WIT provides them
            }
            Err(e) => {
                tracing::error!("error running component {component_id}: {:?}", e);
                Err(anyhow::anyhow!("Error executing component {component_id}"))
            }
        }
    }
}

pub fn current_unix_time() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("SystemTime before UNIX EPOCH!")
        .as_secs() as u128
}
