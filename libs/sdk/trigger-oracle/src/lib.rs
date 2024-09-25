use clap::Args;
use serde::{Deserialize, Serialize};

use std::{
    borrow::Borrow,
    collections::{HashMap, HashSet},
    hash::{Hash, Hasher},
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use http::uri::Scheme;
use hyper::Request;
use tokio::sync::{
    broadcast::{channel, Receiver as BroadcastReceiver, Sender as BroadcastSender},
    mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
};
use tracing::Instrument;

use outbound_http::OutboundHttpComponent;
use spin_app::MetadataKey;
use spin_core::{async_trait, InstancePre, OutboundWasiHttpHandler};
use spin_outbound_networking::{AllowedHostsConfig, OutboundUrl};
use spin_trigger::{TriggerAppEngine, TriggerExecutor};

use wasmtime_wasi_http::{
    bindings::wasi::http::types::ErrorCode, body::HyperOutgoingBody,
    types::HostFutureIncomingResponse, HttpResult,
};

use crypto::JsonSerializableSignature;
use data_feeds::connector::post::generate_signature;
use feed_registry::types::{DataFeedPayload, FeedResult, FeedType, PayloadMetaData};

wasmtime::component::bindgen!({
    path: "../wit",
    world: "blocksense-oracle",
    async: true
});

use blocksense::oracle::oracle_types as oracle;

pub(crate) type RuntimeData = HttpRuntimeData;
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
    secret_key: String,
    interval_time_in_seconds: u64,
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
    interval_time_in_seconds: Option<u64>,
    sequencer: Option<String>,
    secret_key: Option<String>,
}

#[derive(Clone, Eq, Debug, Default, Deserialize, Serialize)]
pub struct DataFeedSetting {
    pub id: String,
    pub data: String,
}

impl PartialEq for DataFeedSetting {
    fn eq(&self, other: &DataFeedSetting) -> bool {
        self.id == other.id
    }
}

impl Hash for DataFeedSetting {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.id.hash(state);
    }
}

impl Borrow<String> for DataFeedSetting {
    fn borrow(&self) -> &String {
        &self.id
    }
}

// Per-component settings (raw serialization format)
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct OracleTriggerConfig {
    component: String,
    data_feeds: Vec<DataFeedSetting>,
}

#[derive(Clone, Debug)]
struct Component {
    pub id: String,
    pub oracle_settings: HashSet<DataFeedSetting>,
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
        let metadata = engine
            .app()
            .require_metadata(TRIGGER_METADATA_KEY)?
            .settings
            .unwrap_or_default();

        let interval_time_in_seconds = metadata
            .interval_time_in_seconds
            .expect("Report time interval not provided");
        let sequencer = metadata.sequencer.expect("Sequencer URL is not provided");
        let secret_key = metadata.secret_key.expect("Secret key is not provided");
        // TODO(adikov) There is a specific case in which one reporter receives task to report multiple
        // data feeds which are gathered from one wasm component. For example -
        // USD/BTC and USD/ETH. In that case we need to optimize calling the component once and
        // returning results for both data feeds.
        let queue_components = engine
            .trigger_configs()
            .map(|(_, config)| {
                (
                    config.component.clone(),
                    Component {
                        id: config.component.clone(),
                        oracle_settings: HashSet::from_iter(config.data_feeds.iter().cloned()),
                    },
                )
            })
            .collect();

        tracing::info!("Oracle Trigger initialized: {}", &engine.app_name);

        Ok(Self {
            engine,
            sequencer,
            secret_key,
            interval_time_in_seconds,
            queue_components,
        })
    }

    async fn run(self, config: Self::RunConfig) -> anyhow::Result<()> {
        let engine = Arc::new(self.engine);
        if config.test {
            for component in self.queue_components.values() {
                Self::execute_wasm(engine.clone(), component, vec![]).await?;
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
        let (data_feed_sender, data_feed_receiver) = unbounded_channel();
        let (signal_data_feed_sender, _) = channel(16);
        //TODO(adikov): Move all the logic to a different struct and handle
        //errors properly.
        // For each component, run its own timer loop

        let components = self.queue_components.clone();
        tracing::info!("Components: {:?}", &components);
        let mut loops: Vec<_> = self
            .queue_components
            .into_values()
            .map(|component| {
                Self::start_oracle_loop(
                    engine.clone(),
                    signal_data_feed_sender.subscribe(),
                    data_feed_sender.clone(),
                    &component,
                )
            })
            .collect();

        let orchestrator = Self::start_orchestrator(
            tokio::time::Duration::from_secs(self.interval_time_in_seconds),
            components,
            signal_data_feed_sender.clone(),
        );
        loops.push(orchestrator);

        let manager = Self::start_manager(data_feed_receiver, &self.sequencer, &self.secret_key);
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
        signal_receiver: BroadcastReceiver<HashSet<DataFeedSetting>>,
        payload_sender: UnboundedSender<(String, Payload)>,
        component: &Component,
    ) -> tokio::task::JoinHandle<TerminationReason> {
        let future = Self::execute(engine, signal_receiver, payload_sender, component.clone());
        tokio::task::spawn(future)
    }

    async fn execute(
        engine: Arc<TriggerAppEngine<Self>>,
        mut signal_receiver: BroadcastReceiver<HashSet<DataFeedSetting>>,
        payload_sender: UnboundedSender<(String, Payload)>,
        component: Component,
    ) -> TerminationReason {
        while let Ok(feeds) = signal_receiver.recv().await {
            let intersection: Vec<_> = component
                .oracle_settings
                .intersection(&feeds)
                .cloned()
                .collect();

            if intersection.is_empty() {
                tracing::trace!("Empty intersection between component {}", &component.id);
                continue;
            }

            //TODO(adikov): start using the intersection.
            let payload = match Self::execute_wasm(engine.clone(), &component, intersection).await {
                Ok(payload) => payload,
                Err(error) => {
                    tracing::error!(
                        "Component - ({}) execution ended with error {}",
                        &component.id,
                        error
                    );
                    //TODO(adikov): We need to come up with proper way of handling errors in wasm
                    //components.
                    continue;
                }
            };
            match payload_sender.send((component.id.clone(), payload)) {
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

    fn start_orchestrator(
        time_interval: tokio::time::Duration,
        components: HashMap<String, Component>,
        signal_sender: BroadcastSender<HashSet<DataFeedSetting>>,
    ) -> tokio::task::JoinHandle<TerminationReason> {
        let future = Self::signal_data_feeds(time_interval, components, signal_sender);

        tokio::task::spawn(future)
    }

    async fn signal_data_feeds(
        time_interval: tokio::time::Duration,
        components: HashMap<String, Component>,
        signal_sender: BroadcastSender<HashSet<DataFeedSetting>>,
    ) -> TerminationReason {
        //TODO(adikov): Implement proper logic and remove dummy values
        loop {
            let _ = tokio::time::sleep(time_interval).await;

            let data_feed_signal = components
                .iter()
                .map(|(_, comp)| comp.oracle_settings.clone())
                .flatten()
                .collect();
            tracing::info!("Signal data feeds: {:?}", &data_feed_signal);
            let _ = signal_sender.send(data_feed_signal);
        }

        //TerminationReason::Other("Signal data feed loop terminated".to_string())
    }

    fn start_manager(
        rx: UnboundedReceiver<(String, Payload)>,
        sequencer: &str,
        secret_key: &str,
    ) -> tokio::task::JoinHandle<TerminationReason> {
        let future = Self::process_payload(rx, sequencer.to_owned(), secret_key.to_owned());

        tokio::task::spawn(future)
    }

    async fn process_payload(
        mut rx: UnboundedReceiver<(String, Payload)>,
        sequencer: String,
        secret_key: String,
    ) -> TerminationReason {
        while let Some((_component_id, payload)) = rx.recv().await {
            let timestamp = current_unix_time();
            //TODO(adikov): Implement a way to send multiple results to the sequencer and properly
            //handle this here.
            for oracle::DataFeedResult { id, value } in payload.values {
                let result = FeedResult::Result {
                    result: FeedType::Numerical(value),
                };
                let signature =
                    generate_signature(&secret_key, id.as_str(), timestamp, &result).unwrap();

                let payload_json = DataFeedPayload {
                    payload_metadata: PayloadMetaData {
                        reporter_id: 1,
                        feed_id: id,
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
                    }
                };
            }
        }

        TerminationReason::SequencerExitRequested
    }

    async fn execute_wasm(
        engine: Arc<TriggerAppEngine<Self>>,
        component: &Component,
        feeds: Vec<DataFeedSetting>,
    ) -> anyhow::Result<Payload> {
        // Load the guest...
        let component_id = component.id.clone();
        let (instance, mut store) = engine.prepare_instance(&component_id).await?;
        let instance = BlocksenseOracle::new(&mut store, &instance)?;

        // We are getting the spin configuration from the Outbound HTTP host component similar to
        // `set_http_origin_from_request` in spin http trigger.
        if let Some(outbound_http_handle) = engine
            .engine
            .find_host_component_handle::<Arc<OutboundHttpComponent>>()
        {
            let outbound_http_data = store
                .host_components_data()
                .get_or_insert(outbound_http_handle);
            store.as_mut().data_mut().as_mut().allowed_hosts =
                outbound_http_data.allowed_hosts.clone();
        }

        // ...and call the entry point
        tracing::trace!(
            "Triggering application: {}; component_id: {}; data_feed: {}",
            &engine.app_name,
            component_id,
            &component.id
        );

        let wit_settings = oracle::Settings {
            data_feeds: feeds
                .iter()
                .cloned()
                .map(|feed| oracle::DataFeed {
                    id: feed.id,
                    data: feed.data,
                })
                .collect(),
        };
        match instance
            .call_handle_oracle_request(&mut store, &wit_settings)
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

#[derive(Default)]
pub struct HttpRuntimeData {
    /// The hosts this app is allowed to make outbound requests to
    allowed_hosts: AllowedHostsConfig,
}

// This implementation is similar to how http trigger implements allow hosts.
impl OutboundWasiHttpHandler for HttpRuntimeData {
    fn send_request(
        data: &mut spin_core::Data<Self>,
        request: Request<HyperOutgoingBody>,
        config: wasmtime_wasi_http::types::OutgoingRequestConfig,
    ) -> HttpResult<wasmtime_wasi_http::types::HostFutureIncomingResponse> {
        let this = data.as_mut();

        let uri = request.uri();
        let uri_string = uri.to_string();
        let unallowed = !this.allowed_hosts.allows(
            &OutboundUrl::parse(uri_string, "https")
                .map_err(|_| ErrorCode::HttpRequestUriInvalid)?,
        );
        if unallowed {
            tracing::error!("Destination not allowed: {}", request.uri());
            let host = if unallowed {
                // Safe to unwrap because absolute urls have a host by definition.
                let host = uri.authority().map(|a| a.host()).unwrap();
                let port = uri.authority().map(|a| a.port()).unwrap();
                let port = match port {
                    Some(port_str) => port_str.to_string(),
                    None => uri
                        .scheme()
                        .and_then(|s| (s == &Scheme::HTTP).then_some(80))
                        .unwrap_or(443)
                        .to_string(),
                };
                terminal::warn!(
                    "A component tried to make a HTTP request to non-allowed host '{host}'."
                );
                let scheme = uri.scheme().unwrap_or(&Scheme::HTTPS);
                format!("{scheme}://{host}:{port}")
            } else {
                terminal::warn!("A component tried to make a HTTP request to the same component but it does not have permission.");
                "self".into()
            };
            eprintln!("To allow requests, add 'allowed_outbound_hosts = [\"{}\"]' to the manifest component section.", host);
            return Err(ErrorCode::HttpRequestDenied.into());
        }

        let current_span = tracing::Span::current();
        let uri = request.uri();
        if let Some(authority) = uri.authority() {
            current_span.record("server.address", authority.host());
            if let Some(port) = authority.port() {
                current_span.record("server.port", port.as_u16());
            }
        }

        // TODO: This is a temporary workaround to make sure that outbound task is instrumented.
        // Once Wasmtime gives us the ability to do the spawn ourselves we can just call .instrument
        // and won't have to do this workaround.
        let response_handle = async move {
            let res =
                wasmtime_wasi_http::types::default_send_request_handler(request, config).await;
            if let Ok(res) = &res {
                tracing::Span::current()
                    .record("http.response.status_code", res.resp.status().as_u16());
            }
            Ok(res)
        }
        .in_current_span();
        Ok(HostFutureIncomingResponse::Pending(
            wasmtime_wasi::runtime::spawn(response_handle),
        ))
    }
}

pub fn current_unix_time() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("SystemTime before UNIX EPOCH!")
        .as_secs() as u128
}
