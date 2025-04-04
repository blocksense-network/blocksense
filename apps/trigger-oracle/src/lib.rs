use clap::Args;
use serde::{Deserialize, Serialize};

use std::{
    borrow::Borrow,
    collections::{HashMap, HashSet},
    hash::{Hash, Hasher},
    sync::Arc,
    time::Instant,
};

use http::uri::Scheme;
use hyper::Request;
use tokio::sync::{
    broadcast::{
        channel, error::RecvError, Receiver as BroadcastReceiver, Sender as BroadcastSender,
    },
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
use data_feeds::generate_signature::generate_signature;
use feed_registry::types::{DataFeedPayload, FeedError, FeedType, PayloadMetaData};
use prometheus::{
    actix_server::handle_prometheus_metrics,
    metrics::{
        REPORTER_BATCH_COUNTER, REPORTER_FAILED_SEQ_REQUESTS, REPORTER_FAILED_WASM_EXECS,
        REPORTER_FEED_COUNTER, REPORTER_WASM_EXECUTION_TIME_GAUGE,
    },
    TextEncoder,
};
use utils::time::current_unix_time;

wasmtime::component::bindgen!({
    path: "../../libs/sdk/wit",
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
    prometheus_url: Option<String>,
    secret_key: String,
    reporter_id: u64,
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
    prometheus_url: Option<String>,
    secret_key: Option<String>,
    reporter_id: Option<u64>,
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

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct CapabilitySetting {
    pub id: String,
    pub data: String,
}

// Per-component settings (raw serialization format)
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct OracleTriggerConfig {
    component: String,
    data_feeds: Vec<DataFeedSetting>,
    capabilities: Option<Vec<CapabilitySetting>>,
    interval_time_in_seconds: Option<u64>,
}

#[derive(Clone, Debug)]
struct Component {
    pub id: String,
    pub oracle_settings: HashSet<DataFeedSetting>,
    pub capabilities: Vec<CapabilitySetting>,
    pub interval_time_in_seconds: u64,
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
    ReceivedBadSignal(RecvError),
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
        let prometheus_url = metadata.prometheus_url;
        let secret_key = metadata.secret_key.expect("Secret key is not provided");
        let reporter_id = metadata.reporter_id.expect("Reporter ID is not provided");
        // TODO(adikov) There is a specific case in which one reporter receives task to report multiple
        // data feeds which are gathered from one wasm component. For example -
        // USD/BTC and USD/ETH. In that case we need to optimize calling the component once and
        // returning results for both data feeds.
        let queue_components = engine
            .trigger_configs()
            .map(|(_, config)| {
                let mut capabilities = vec![];
                if let Some(cap) = &config.capabilities {
                    capabilities = cap.clone();
                }

                REPORTER_FEED_COUNTER.inc_by(config.data_feeds.len() as u64);
                (
                    config.component.clone(),
                    Component {
                        id: config.component.clone(),
                        oracle_settings: HashSet::from_iter(config.data_feeds.iter().cloned()),
                        capabilities,
                        interval_time_in_seconds: config
                            .interval_time_in_seconds
                            .unwrap_or(interval_time_in_seconds),
                    },
                )
            })
            .collect();

        tracing::info!("Oracle Trigger initialized: {}", &engine.app_name);

        Ok(Self {
            engine,
            sequencer,
            prometheus_url,
            secret_key,
            reporter_id,
            queue_components,
        })
    }

    async fn run(self, config: Self::RunConfig) -> anyhow::Result<()> {
        tracing::trace!("Starting Blocksense Reporter");

        let engine = Arc::new(self.engine);
        if config.test {
            tracing::trace!("Running in test mode");
            for component in self.queue_components.values() {
                let settings: Vec<DataFeedSetting> =
                    component.oracle_settings.clone().into_iter().collect();
                Self::execute_wasm(engine.clone(), component, settings).await?;
            }
            return Ok(());
        }
        tracing::trace!("Running in production mode");

        // This trigger spawns threads, which Ctrl+C does not kill.  So
        // for this case we need to detect Ctrl+C and shut those threads
        // down. For simplicity, we do this by terminating the process.
        tokio::task::Builder::new()
            .name("ctrl-c watcher")
            .spawn(async move {
                tracing::trace!("Task ctrl-c watcher started");
                tokio::signal::ctrl_c().await.unwrap();
                tracing::trace!("ctrl-c detected; terminating process");
                std::process::exit(0);
            })
            .expect("ctrl-c watcher failed to start");

        tracing::info!("Sequencer URL provided: {}", &self.sequencer);
        let (data_feed_sender, data_feed_receiver) = unbounded_channel();
        let (signal_data_feed_sender, _) = channel(16);
        //TODO(adikov): Move all the logic to a different struct and handle
        //errors properly.
        // For each component, run its own timer loop

        let components = self.queue_components.clone();
        tracing::debug!("Components: {:?}", &components);
        tracing::trace!("Starting oracle scripts");
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

        tracing::trace!("Starting orchestrator");
        let mut orchestrators = Self::start_orchestrators(
            components,
            signal_data_feed_sender.clone(),
            self.prometheus_url,
        );
        loops.append(&mut orchestrators);

        tracing::trace!("Starting sender to sequencer");
        let url = url::Url::parse(&self.sequencer.clone())?;
        let sequencer_url = url.join("/post_reports_batch")?;
        let manager = Self::start_manager(
            data_feed_receiver,
            &sequencer_url,
            &self.secret_key,
            self.reporter_id,
        );
        loops.push(manager);

        loop {
            let (tr, _, rest) = futures::future::select_all(loops).await;

            match tr.expect("await returns ok") {
                TerminationReason::ExitRequested => {
                    tracing::trace!("Exit requested => exiting");
                    return Ok(());
                }
                TerminationReason::SequencerExitRequested => {
                    tracing::trace!("Sequencer exit requested => exiting");
                    return Ok(());
                }
                TerminationReason::ReceivedBadSignal(err) => {
                    tracing::error!("Oracle script runner received bad signal: {err:?}");
                    tracing::trace!("Continuing to run the other runners");
                    loops = rest;
                }
                TerminationReason::Other(message) => {
                    tracing::error!("Unexpected termination reason: {message}");
                    return Err(anyhow::anyhow!("{message}"));
                }
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
        let task_name = format!("processor for {}", component.id);
        tokio::task::Builder::new()
            .name(&task_name)
            .spawn(future)
            .unwrap_or_else(|_| panic!("{task_name} failed to start"))
    }

    async fn execute(
        engine: Arc<TriggerAppEngine<Self>>,
        mut signal_receiver: BroadcastReceiver<HashSet<DataFeedSetting>>,
        payload_sender: UnboundedSender<(String, Payload)>,
        component: Component,
    ) -> TerminationReason {
        let component_id = component.id.clone();
        tracing::trace!("Starting processing loop `{component_id}`");
        loop {
            let feeds = match signal_receiver.recv().await {
                Ok(feeds) => feeds,
                Err(err) => {
                    return TerminationReason::ReceivedBadSignal(err);
                }
            };
            tracing::trace!(
                "Oracle script `{}` received a set of {} active feeds",
                component.id,
                feeds.len()
            );

            let intersection: Vec<_> = component
                .oracle_settings
                .intersection(&feeds)
                .cloned()
                .collect();

            if intersection.is_empty() {
                tracing::trace!("Empty intersection between component {component_id}");
                continue;
            }
            tracing::trace!(
                "Intersection for {} has size {}",
                &component.id,
                intersection.len()
            );

            let payload = match Self::execute_wasm(engine.clone(), &component, intersection).await {
                Ok(payload) => {
                    tracing::trace!("Component `{component_id}` executed successfully");
                    payload
                }
                Err(error) => {
                    tracing::error!(
                        "Component - ({component_id}) execution ended with error {}",
                        error
                    );
                    //TODO(adikov): We need to come up with proper way of handling errors in wasm
                    //components.
                    continue;
                }
            };
            tracing::trace!("Sending update to sequencer for `{component_id}`...");
            match payload_sender.send((component.id.clone(), payload)) {
                Ok(_) => {
                    tracing::trace!("Sent update to sequencer for `{component_id}`");
                    continue;
                }
                Err(err) => {
                    tracing::error!(
                        "Failed to send update to sequencer for `{component_id}` due to {err}"
                    );
                    break;
                }
            };
        }
        tracing::info!("End of execution for `{component_id}`");
        TerminationReason::Other("Oracle execution loop terminated".to_string())
    }

    fn start_orchestrators(
        components: HashMap<String, Component>,
        signal_sender: BroadcastSender<HashSet<DataFeedSetting>>,
        prometheus_url: Option<String>,
    ) -> Vec<tokio::task::JoinHandle<TerminationReason>> {
        let mut join_handles = vec![];
        for (key, component) in components {
            let time_interval =
                tokio::time::Duration::from_secs(component.interval_time_in_seconds);
            let future = Self::signal_data_feeds(
                key.clone(),
                time_interval,
                component.oracle_settings.clone(),
                signal_sender.clone(),
                prometheus_url.clone(),
            );
            join_handles.push(
                tokio::task::Builder::new()
                    .name(format!("orchestrator-{}", key).as_str())
                    .spawn(future)
                    .expect("orchestrator failed to start"),
            );
        }

        join_handles
    }

    async fn signal_data_feeds(
        oracle_id: String,
        time_interval: tokio::time::Duration,
        oracle_settings: HashSet<DataFeedSetting>,
        signal_sender: BroadcastSender<HashSet<DataFeedSetting>>,
        prometheus_url: Option<String>,
    ) -> TerminationReason {
        tracing::trace!("Task orchestrator-{} started", oracle_id);
        //TODO(adikov): Implement proper logic and remove dummy values
        loop {
            REPORTER_BATCH_COUNTER.inc();
            let batch_count = REPORTER_BATCH_COUNTER.get();
            tracing::trace!(
                "Orchestrator-{} entering sleep [batch_count={batch_count}]",
                oracle_id
            );
            let _ = tokio::time::sleep(time_interval).await;
            tracing::trace!(
                "Orchestrator-{} woke up [batch_count={batch_count}]",
                oracle_id
            );

            tracing::trace!(
                "Signal {} data feeds [batch_count={batch_count}]",
                oracle_settings.len()
            );
            let _ = signal_sender.send(oracle_settings.clone());

            if prometheus_url.is_none() {
                tracing::trace!("Prometheus URL not set; looping back [batch_count={batch_count}]");
                continue;
            }

            let prometheus_url = prometheus_url
                .clone()
                .expect("Prometheus URL should be provided.");
            tracing::trace!(
                "Sending metrics to prometheus at {prometheus_url} [batch_count={batch_count}]"
            );
            let metrics_result = handle_prometheus_metrics(
                &reqwest::Client::new(),
                &prometheus_url,
                &TextEncoder::new(),
            )
            .await;

            match metrics_result {
                Ok(_) => {
                    tracing::trace!("Sent metrics to prometheus [batch_count={batch_count}]");
                }
                Err(e) => {
                    tracing::error!(
                        "Error handling Prometheus metrics: {e:?} [batch_count={batch_count}]"
                    );
                }
            }
        }
        // unreachable!("No breaks in orchestrator loop");

        //TerminationReason::Other("Signal data feed loop terminated".to_string())
    }

    fn start_manager(
        rx: UnboundedReceiver<(String, Payload)>,
        sequencer: &url::Url,
        secret_key: &str,
        reporter_id: u64,
    ) -> tokio::task::JoinHandle<TerminationReason> {
        let future =
            Self::process_payload(rx, sequencer.to_owned(), secret_key.to_owned(), reporter_id);

        tokio::task::Builder::new()
            .name("sender to sequencer")
            .spawn(future)
            .expect("sender to sequencer failed to start")
    }

    async fn process_payload(
        mut rx: UnboundedReceiver<(String, Payload)>,
        sequencer: url::Url,
        secret_key: String,
        reporter_id: u64,
    ) -> TerminationReason {
        tracing::trace!("Task sender to sequencer started");
        while let Some((_component_id, payload)) = rx.recv().await {
            tracing::trace!(
                "Sender to sequencer received payload of size {}",
                payload.values.len()
            );
            let timestamp = current_unix_time();
            let mut batch_payload = vec![];
            for oracle::DataFeedResult { id, value } in payload.values {
                let result = match value {
                    oracle::DataFeedResultValue::Numerical(value) => Ok(FeedType::Numerical(value)),
                    oracle::DataFeedResultValue::Text(value) => Ok(FeedType::Text(value)),
                    oracle::DataFeedResultValue::Error(error_string) => {
                        Err(FeedError::APIError(error_string))
                    }
                    oracle::DataFeedResultValue::None => {
                        tracing::warn!("Encountered None result for feed id {id}");
                        //TODO(adikov): Handle properly None result
                        continue;
                    }
                };

                let signature =
                    generate_signature(&secret_key, id.as_str(), timestamp, &result).unwrap();

                batch_payload.push(DataFeedPayload {
                    payload_metadata: PayloadMetaData {
                        reporter_id,
                        feed_id: id,
                        timestamp,
                        signature: JsonSerializableSignature { sig: signature },
                    },
                    result,
                });
            }
            //TODO(adikov): Potential better implementation would be to send results to the
            //sequencer every few seconds in which we can gather batches of data feed payloads.

            tracing::trace!(
                "Sending to url - {}; {} batches",
                sequencer.clone(),
                batch_payload.len()
            );
            let client = reqwest::Client::new();
            match client
                .post(sequencer.clone())
                .json(&batch_payload)
                .send()
                .await
            {
                Ok(res) => {
                    let status = res.status();
                    let contents = res.text().await.unwrap();
                    tracing::trace!("Sequencer responded with status={status} and text={contents}",);
                }
                Err(e) => {
                    //TODO(adikov): Add code from the error - e.status()
                    REPORTER_FAILED_SEQ_REQUESTS
                        .with_label_values(&["404"])
                        .inc();

                    tracing::error!("Sequencer failed to respond with; err={e}");
                }
            };
            tracing::trace!("Sender to sequencer waiting for new payload...");
        }

        tracing::trace!("Task sender to sequencer ending");

        TerminationReason::SequencerExitRequested
    }

    async fn execute_wasm(
        engine: Arc<TriggerAppEngine<Self>>,
        component: &Component,
        feeds: Vec<DataFeedSetting>,
    ) -> anyhow::Result<Payload> {
        let component_id = component.id.clone();
        tracing::trace!("Loading guest for `{component_id }`");

        // Load the guest...
        let (instance, mut store) = engine.prepare_instance(&component_id).await?;
        let instance = BlocksenseOracle::new(&mut store, &instance)?;

        tracing::trace!("Successfully loaded guest for `{component_id}`");

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
            "Triggering application: {}; component_id: {component_id}",
            &engine.app_name
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
            capabilities: component
                .capabilities
                .iter()
                .cloned()
                .map(|capability| oracle::Capability {
                    id: capability.id,
                    data: capability.data,
                })
                .collect(),
        };

        let start_time = Instant::now();
        tracing::trace!("Calling handle oracle request for `{component_id}`");
        let result = instance
            .call_handle_oracle_request(&mut store, &wit_settings)
            .await;
        let elapsed_time_ms = start_time.elapsed().as_millis();
        tracing::trace!("Oracle request for `{component_id}` completed in {elapsed_time_ms}ms");
        REPORTER_WASM_EXECUTION_TIME_GAUGE
            .with_label_values(&[&component_id.clone()])
            .set(elapsed_time_ms as i64);

        match result {
            Ok(Ok(payload)) => {
                tracing::info!("Component {component_id} completed okay");
                // TODO(stanm): increment metric for successful executions

                Ok(payload)
            }
            Ok(Err(e)) => {
                tracing::warn!("Component {component_id} returned error {:?}", e);
                REPORTER_FAILED_WASM_EXECS
                    .with_label_values(&[&component_id.clone()])
                    .inc();
                Err(anyhow::anyhow!("Component {component_id} returned error")) // TODO: more details when WIT provides them
            }
            Err(e) => {
                tracing::error!("error running component {component_id}: {:?}", e);
                REPORTER_FAILED_WASM_EXECS
                    .with_label_values(&[&component_id.clone()])
                    .inc();
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
