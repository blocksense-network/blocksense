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
    broadcast::{channel, Receiver as BroadcastReceiver, Sender as BroadcastSender},
    mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
};
use tracing::Instrument;

use rdkafka::config::ClientConfig;
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::Message;
// use rdkafka::message::{BorrowedMessage, Message};
use tokio_stream::StreamExt;

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

use gnosis_safe::{
    data_types::{ConsensusSecondRoundBatch, ReporterResponse},
    utils::{create_fixed_bytes, create_private_key_signer, get_signature_bytes, sign_hash},
};

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
    kafka_endpoint: String,
    secret_key: String,
    second_consensus_secret_key: String,
    reporter_id: u64,
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
    prometheus_url: Option<String>,
    kafka_endpoint: Option<String>,
    secret_key: Option<String>,
    second_consensus_secret_key: Option<String>,
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
}

#[derive(Clone, Debug)]
struct Component {
    pub id: String,
    pub oracle_settings: HashSet<DataFeedSetting>,
    pub capabilities: Vec<CapabilitySetting>,
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
        let prometheus_url = metadata.prometheus_url;
        let kafka_endpoint = metadata
            .kafka_endpoint
            .expect("Kafka Endpoint is not provided");
        let secret_key = metadata.secret_key.expect("Secret key is not provided");
        let second_consensus_secret_key = metadata
            .second_consensus_secret_key
            .expect("Second consensus secret key is not provided");
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
                    },
                )
            })
            .collect();

        tracing::info!("Oracle Trigger initialized: {}", &engine.app_name);

        Ok(Self {
            engine,
            sequencer,
            prometheus_url,
            kafka_endpoint,
            secret_key,
            second_consensus_secret_key,
            reporter_id,
            interval_time_in_seconds,
            queue_components,
        })
    }

    async fn run(self, config: Self::RunConfig) -> anyhow::Result<()> {
        let engine = Arc::new(self.engine);
        if config.test {
            for component in self.queue_components.values() {
                let settings: Vec<DataFeedSetting> =
                    component.oracle_settings.clone().into_iter().collect();
                Self::execute_wasm(engine.clone(), component, settings).await?;
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
        let (aggregated_consensus_sender, aggregated_consensus_receiver) = unbounded_channel();
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
            self.prometheus_url,
        );
        loops.push(orchestrator);

        //TODO(adikov): get kafka endpoint from the configuration
        let secondary_signature = Self::start_secondary_signature_listener(
            self.kafka_endpoint,
            aggregated_consensus_sender.clone(),
            None,
        );
        loops.push(secondary_signature);

        let url = url::Url::parse(&self.sequencer.clone())?;
        let sequencer_post_batch_url = url.join("/post_reports_batch")?;
        let sequencer_aggregated_consensus_url = url.join("/post_aggregated_consensus_vote")?;
        let mut manager = Self::start_manager(
            data_feed_receiver,
            aggregated_consensus_receiver,
            &sequencer_post_batch_url,
            &sequencer_aggregated_consensus_url,
            &self.secret_key,
            &self.second_consensus_secret_key,
            self.reporter_id,
        );
        loops.append(&mut manager);

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
        prometheus_url: Option<String>,
    ) -> tokio::task::JoinHandle<TerminationReason> {
        let future =
            Self::signal_data_feeds(time_interval, components, signal_sender, prometheus_url);

        tokio::task::spawn(future)
    }

    async fn signal_data_feeds(
        time_interval: tokio::time::Duration,
        components: HashMap<String, Component>,
        signal_sender: BroadcastSender<HashSet<DataFeedSetting>>,
        prometheus_url: Option<String>,
    ) -> TerminationReason {
        //TODO(adikov): Implement proper logic and remove dummy values
        loop {
            REPORTER_BATCH_COUNTER.inc();
            let _ = tokio::time::sleep(time_interval).await;

            let data_feed_signal = components
                .values()
                .flat_map(|comp| comp.oracle_settings.clone())
                .collect();
            // tracing::info!("Signal data feeds: {:?}", &data_feed_signal);
            let _ = signal_sender.send(data_feed_signal);

            if prometheus_url.is_none() {
                continue;
            }

            let metrics_result = handle_prometheus_metrics(
                &reqwest::Client::new(),
                prometheus_url
                    .clone()
                    .expect("Prometheus URL should be provided.")
                    .as_str(),
                &TextEncoder::new(),
            )
            .await;
            if let Err(e) = metrics_result {
                tracing::debug!("Error handling Prometheus metrics: {:?}", e);
            }
        }

        //TerminationReason::Other("Signal data feed loop terminated".to_string())
    }

    fn start_secondary_signature_listener(
        kafka_report_endpoint: String,
        signal_sender: UnboundedSender<ConsensusSecondRoundBatch>,
        kafka_info: Option<String>,
    ) -> tokio::task::JoinHandle<TerminationReason> {
        let future =
            Self::signal_secondary_signature(kafka_report_endpoint, signal_sender, kafka_info);

        tokio::task::spawn(future)
    }

    async fn signal_secondary_signature(
        kafka_report_endpoint: String,
        signal_sender: UnboundedSender<ConsensusSecondRoundBatch>,
        _kafka_info: Option<String>,
    ) -> TerminationReason {
        // TODO(adikov): remove unwrap/expect
        // TODO(adikov): get all kafka configuration from `kafka_info` parameter

        // Configure the Kafka consumer
        let consumer: StreamConsumer = ClientConfig::new()
            .set("bootstrap.servers", kafka_report_endpoint)
            .set("group.id", "no_commit_group") // Consumer group ID
            .set("enable.auto.commit", "false") // Disable auto-commit
            .set("auto.offset.reset", "latest") // Start from latest always
            .create()
            .expect("Failed to create Kafka consumer");

        // Subscribe to the desired topic(s)
        consumer
            .subscribe(&["aggregation_consensus"])
            .expect("Failed to subscribe to topic");

        // Asynchronously process messages using a stream
        let mut message_stream = consumer.stream();

        loop {
            if let Some(message_result) = message_stream.next().await {
                match message_result {
                    Ok(message) => {
                        let payload = match message.payload() {
                            None => {
                                tracing::warn!("kafka None message received ");
                                continue;
                            }
                            Some(bytes) => match serde_json::from_slice(bytes) {
                                Ok(r) => r,
                                Err(err) => {
                                    tracing::error!("Error while parsing the message: {:?}", err);
                                    continue;
                                }
                            },
                        };
                        tracing::debug!("kafka message received - {:?}", payload);

                        match signal_sender.send(payload) {
                            Ok(_) => {
                                continue;
                            }
                            Err(_) => {
                                break;
                            }
                        };
                    }
                    Err(err) => {
                        // Handle message errors
                        tracing::error!("Error while consuming: {:?}", err);
                    }
                }
            }
        }

        TerminationReason::Other("Signal secondary consensus loop terminated".to_string())
    }

    fn start_manager(
        rx: UnboundedReceiver<(String, Payload)>,
        ss_rx: UnboundedReceiver<ConsensusSecondRoundBatch>,
        sequencer_post_batch: &url::Url,
        sequencer_aggregated_consensus: &url::Url,
        secret_key: &str,
        second_consensus_secret_key: &str,
        reporter_id: u64,
    ) -> Vec<tokio::task::JoinHandle<TerminationReason>> {
        let process_payload_future = Self::process_payload(
            rx,
            sequencer_post_batch.to_owned(),
            secret_key.to_owned(),
            reporter_id,
        );

        let process_aggregated_consensus_future = Self::process_aggregated_consensus(
            ss_rx,
            sequencer_aggregated_consensus.to_owned(),
            second_consensus_secret_key.to_owned(),
            reporter_id,
        );

        vec![
            tokio::task::spawn(process_payload_future),
            tokio::task::spawn(process_aggregated_consensus_future),
        ]
    }

    async fn process_payload(
        mut rx: UnboundedReceiver<(String, Payload)>,
        sequencer: url::Url,
        secret_key: String,
        reporter_id: u64,
    ) -> TerminationReason {
        while let Some((_component_id, payload)) = rx.recv().await {
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
                    let contents = res.text().await.unwrap();
                    tracing::trace!("Sequencer responded with: {}", &contents);
                }
                Err(e) => {
                    //TODO(adikov): Add code from the error - e.status()
                    REPORTER_FAILED_SEQ_REQUESTS
                        .with_label_values(&["404"])
                        .inc();

                    tracing::error!("Sequencer failed to respond with: {}", &e);
                }
            };
        }

        TerminationReason::SequencerExitRequested
    }

    async fn process_aggregated_consensus(
        mut ss_rx: UnboundedReceiver<ConsensusSecondRoundBatch>,
        sequencer: url::Url,
        second_consensus_secret_key: String,
        reporter_id: u64,
    ) -> TerminationReason {
        while let Some(aggregated_consensus) = ss_rx.recv().await {
            let signer = create_private_key_signer(second_consensus_secret_key.as_str());
            let tx = create_fixed_bytes(aggregated_consensus.tx_hash.as_str());
            let signed = match sign_hash(&signer, &tx).await {
                Ok(s) => s,
                Err(e) => {
                    tracing::error!("Failed to sign hash on second consensus: {}", &e);
                    continue;
                }
            };
            let signature = match String::from_utf8(get_signature_bytes(&mut [signed]).await) {
                Ok(s) => s,
                Err(e) => {
                    tracing::error!("Failed to parse signature to string: {}", &e);
                    continue;
                }
            };
            let report = ReporterResponse {
                block_height: aggregated_consensus.block_height,
                reporter_id,
                network: aggregated_consensus.network,
                signature,
            };

            tracing::trace!("Sending to url - {}; {:?} hash", sequencer.clone(), &report);

            let client = reqwest::Client::new();
            match client.post(sequencer.clone()).json(&report).send().await {
                Ok(res) => {
                    let contents = res.text().await.unwrap();
                    tracing::trace!("Sequencer responded with: {}", &contents);
                }
                Err(e) => {
                    //TODO(adikov): Add code from the error - e.status()
                    REPORTER_FAILED_SEQ_REQUESTS
                        .with_label_values(&["404"])
                        .inc();

                    tracing::error!("Sequencer failed to respond with: {}", &e);
                }
            };
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
        let result = instance
            .call_handle_oracle_request(&mut store, &wit_settings)
            .await;
        let elapsed_time_ms = start_time.elapsed().as_millis();
        REPORTER_WASM_EXECUTION_TIME_GAUGE
            .with_label_values(&[&component_id.clone()])
            .set(elapsed_time_ms as i64);

        match result {
            Ok(Ok(payload)) => {
                tracing::info!("Component {component_id} completed okay");

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
