mod custom_serde;

use clap::Args;
use custom_serde::serialize_string_as_json;
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
use tokio::{
    sync::{
        broadcast::{
            channel, error::RecvError, Receiver as BroadcastReceiver, Sender as BroadcastSender,
        },
        mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
        RwLock,
    },
    task::{spawn, Builder, JoinHandle},
    time::{sleep, timeout, timeout_at, Duration},
};
use tracing::Instrument;
use url::Url;

use rdkafka::config::ClientConfig;
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::Message;
use tokio_stream::StreamExt;

use outbound_http::OutboundHttpComponent;
use spin_app::MetadataKey;
use spin_core::{async_trait, InstancePre, OutboundWasiHttpHandler, Store};
use spin_outbound_networking::{AllowedHostsConfig, OutboundUrl};
use spin_trigger::{TriggerAppEngine, TriggerExecutor};

use wasmtime_wasi_http::{
    bindings::wasi::http::types::ErrorCode, body::HyperOutgoingBody,
    types::HostFutureIncomingResponse, HttpResult,
};

use blocksense_config::FeedStrideAndDecimals;
use blocksense_crypto::JsonSerializableSignature;
use blocksense_data_feeds::{
    feeds_processing::VotedFeedUpdate, generate_signature::generate_signature,
};
use blocksense_feed_registry::{
    registry::SlotTimeTracker,
    types::{DataFeedPayload, FeedError, FeedType, PayloadMetaData, Repeatability},
};
use blocksense_feeds_processing::utils::validate;
use blocksense_metrics::{
    actix_server::handle_prometheus_metrics,
    metrics::{
        REPORTER_BATCH_COUNTER, REPORTER_FAILED_SEQ_REQUESTS, REPORTER_FAILED_WASM_EXECS,
        REPORTER_FEED_COUNTER, REPORTER_WASM_EXECUTION_TIME_GAUGE,
    },
    TextEncoder,
};
use blocksense_utils::time::current_unix_time;

use blocksense_gnosis_safe::{
    data_types::{ConsensusSecondRoundBatch, ReporterResponse},
    utils::{bytes_to_hex_string, create_private_key_signer, hex_str_to_bytes32, sign_hash},
};

wasmtime::component::bindgen!({
    path: "../../libs/sdk/wit",
    world: "blocksense-oracle",
    async: true,
});

use blocksense::oracle::oracle_types as oracle;

pub(crate) type RuntimeData = HttpRuntimeData;
pub(crate) type _Store = spin_core::Store<RuntimeData>;
type DataFeedResults = Arc<RwLock<HashMap<u32, VotedFeedUpdate>>>;

const TIME_BEFORE_KAFKA_READ_RETRY_IN_MS: u64 = 500;
const TOTAL_RETRIES_FOR_KAFKA_READ: u64 = 10;

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
    kafka_endpoint: Option<String>,
    secret_key: String,
    second_consensus_secret_key: String,
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
    kafka_endpoint: Option<String>,
    secret_key: Option<String>,
    second_consensus_secret_key: Option<String>,
    reporter_id: Option<u64>,
}

#[derive(Clone, Eq, Debug, Default, Deserialize, Serialize)]
pub struct DataFeedSetting {
    pub id: String,
    pub stride: u16,
    pub decimals: u8,
    #[serde(serialize_with = "serialize_string_as_json")]
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

#[derive(Clone, Debug, Serialize, Deserialize)]
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

        let second_consensus_secret_key = if metadata.kafka_endpoint.is_some() {
            metadata
                .second_consensus_secret_key
                .expect("Second consensus secret key is not provided")
        } else {
            "".into()
        };

        let kafka_endpoint = metadata.kafka_endpoint;

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
            kafka_endpoint,
            secret_key,
            second_consensus_secret_key,
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
        Builder::new()
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
        let (signal_data_feed_sender, _) = channel(64);
        let data_feed_results: DataFeedResults = Arc::new(RwLock::new(HashMap::new()));
        let mut feeds_config = HashMap::new();
        //TODO(adikov): Move all the logic to a different struct and handle
        //errors properly.
        // For each component, run its own timer loop

        let components = self.queue_components.clone();
        for component in components.values() {
            for df in &component.oracle_settings {
                feeds_config.insert(
                    df.id.parse::<u32>()?,
                    FeedStrideAndDecimals {
                        stride: df.stride,
                        decimals: df.decimals,
                    },
                );
            }
        }
        tracing::debug!(
            "Components: {}",
            &serde_json::to_string_pretty(&components).unwrap(),
        );
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

        let url = Url::parse(&self.sequencer.clone())?;
        let sequencer_aggregated_consensus_url = url.join("/post_aggregated_consensus_vote")?;

        if let Some(endpoint) = self.kafka_endpoint {
            let (aggregated_consensus_sender, aggregated_consensus_receiver) = unbounded_channel();
            tracing::trace!("Starting secondary signature");
            loops.push(Self::start_secondary_signature_listener(
                endpoint,
                aggregated_consensus_sender,
            ));

            tracing::trace!("Starting process_aggregated_consensus");
            loops.push(tokio::spawn(Self::process_aggregated_consensus(
                aggregated_consensus_receiver,
                feeds_config,
                data_feed_results.clone(),
                sequencer_aggregated_consensus_url,
                self.second_consensus_secret_key,
                self.reporter_id,
            )));
        }

        tracing::trace!("Starting sender to sequencer");
        let sequencer_post_batch_url = url.join("/post_reports_batch")?;
        let manager = Self::start_manager(
            data_feed_receiver,
            data_feed_results,
            &sequencer_post_batch_url,
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
    ) -> JoinHandle<TerminationReason> {
        let future = Self::execute(engine, signal_receiver, payload_sender, component.clone());
        let task_name = format!("processor for {}", component.id);
        Builder::new()
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

            let payload = match timeout(
                Duration::from_secs(component.interval_time_in_seconds),
                Self::execute_wasm(engine.clone(), &component, intersection),
            )
            .await
            {
                Ok(result) => {
                    match result {
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
                    }
                }
                Err(error) => {
                    tracing::error!(
                        "Component - ({component_id}) execution ended with timout - {}",
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
        let time_tracker = SlotTimeTracker::new("feed_update".into(), time_interval, 0);

        loop {
            REPORTER_BATCH_COUNTER.inc();
            let batch_count = REPORTER_BATCH_COUNTER.get();
            tracing::trace!(
                "Orchestrator-{} entering sleep [batch_count={batch_count}]",
                oracle_id
            );

            time_tracker
                .await_end_of_current_slot(&Repeatability::Periodic)
                .await;

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

    fn start_secondary_signature_listener(
        kafka_report_endpoint: String,
        signal_sender: UnboundedSender<ConsensusSecondRoundBatch>,
    ) -> JoinHandle<TerminationReason> {
        let future = Self::signal_secondary_signature(kafka_report_endpoint, signal_sender);

        Builder::new()
            .name("sender to sequencer")
            .spawn(future)
            .expect("sender to sequencer failed to start")
    }

    async fn signal_secondary_signature(
        kafka_report_endpoint: String,
        signal_sender: UnboundedSender<ConsensusSecondRoundBatch>,
    ) -> TerminationReason {
        // Configure the Kafka consumer
        let consumer: StreamConsumer = match ClientConfig::new()
            .set("bootstrap.servers", kafka_report_endpoint)
            .set("group.id", "no_commit_group") // Consumer group ID
            .set("enable.auto.commit", "false") // Disable auto-commit
            .set("auto.offset.reset", "latest") // Start from latest always
            .set("socket.timeout.ms", "300000")
            .set("session.timeout.ms", "400000")
            .set("max.poll.interval.ms", "500000")
            .create()
        {
            Ok(consumer) => consumer,
            Err(err) => {
                tracing::error!("Error while creating kafka consumer: {:?}", err);
                return TerminationReason::Other(format!(
                    "Error while creating kafka consumer: {:?}",
                    err
                ));
            }
        };

        // Subscribe to the desired topic(s)
        if let Err(err) = consumer.subscribe(&["aggregation_consensus"]) {
            return TerminationReason::Other(format!(
                "Error while subscribing to kafka topic: {:?}",
                err
            ));
        };

        // Asynchronously process messages using a stream
        let mut message_stream = consumer.stream();
        let mut total_err_messages = 0;

        while let Some(message_result) = message_stream.next().await {
            match message_result {
                Ok(message) => {
                    total_err_messages = 0;
                    let payload: ConsensusSecondRoundBatch = match message.payload() {
                        None => {
                            tracing::warn!("kafka None message received");
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
                    total_err_messages += 1;
                    if total_err_messages >= TOTAL_RETRIES_FOR_KAFKA_READ {
                        return TerminationReason::Other(format!(
                            "Error while consuming: {:?}",
                            err
                        ));
                    }
                    let _ = sleep(Duration::from_millis(TIME_BEFORE_KAFKA_READ_RETRY_IN_MS)).await;
                    continue;
                }
            }
        }

        TerminationReason::Other("Signal secondary consensus loop terminated".to_string())
    }

    #[allow(clippy::too_many_arguments)]
    fn start_manager(
        payload_rx: UnboundedReceiver<(String, Payload)>,
        latest_votes: DataFeedResults,
        sequencer_post_batch_url: &Url,
        secret_key: &str,
        reporter_id: u64,
    ) -> JoinHandle<TerminationReason> {
        let process_payload_future = Self::process_payload(
            payload_rx,
            latest_votes.clone(),
            sequencer_post_batch_url.to_owned(),
            secret_key.to_owned(),
            reporter_id,
        );

        spawn(process_payload_future)
    }

    async fn process_payload(
        mut rx: UnboundedReceiver<(String, Payload)>,
        latest_votes: DataFeedResults,
        sequencer_url: Url,
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
                sequencer_url.clone(),
                batch_payload.len()
            );
            let client = reqwest::Client::new();
            match client
                .post(sequencer_url.clone())
                .json(&batch_payload)
                .send()
                .await
            {
                Ok(res) => {
                    let status = res.status();
                    let contents = res.text().await.unwrap();
                    tracing::trace!("Sequencer responded with status={status} and text={contents}",);

                    let mut latest_votes = latest_votes.write().await;
                    update_latest_votes(&mut latest_votes, batch_payload);
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

    async fn process_aggregated_consensus(
        mut ss_rx: UnboundedReceiver<ConsensusSecondRoundBatch>,
        feeds_config: HashMap<u32, FeedStrideAndDecimals>,
        latest_votes: DataFeedResults,
        sequencer: Url,
        second_consensus_secret_key: String,
        reporter_id: u64,
    ) -> TerminationReason {
        while let Some(aggregated_consensus) = ss_rx.recv().await {
            let signer = create_private_key_signer(second_consensus_secret_key.as_str());

            let tx = match hex_str_to_bytes32(aggregated_consensus.tx_hash.as_str()) {
                Ok(t) => t,
                Err(e) => {
                    tracing::error!("Failed to parse str to bytes on second consensus: {}", &e);
                    continue;
                }
            };

            let block_height = aggregated_consensus.block_height;
            let network = aggregated_consensus.network.clone();

            match validate(
                feeds_config.clone(),
                aggregated_consensus,
                latest_votes.read().await.clone(),
                HashMap::new(),
            )
            .await
            {
                Ok(_) => {
                    tracing::info!(
                        "Validated batch to post to contract: block_height={block_height}"
                    );
                }
                Err(e) => {
                    tracing::error!(
                        "Failed to validate second consensus for block_height={block_height}: {}",
                        &e
                    );
                    continue;
                }
            };

            let signed = match sign_hash(&signer, &tx).await {
                Ok(s) => s,
                Err(e) => {
                    tracing::error!("Failed to sign hash on second consensus: {}", &e);
                    continue;
                }
            };

            let signature = bytes_to_hex_string(signed.signature);
            let report = ReporterResponse {
                block_height,
                reporter_id,
                network,
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

        let timeout_result =
            execute_wasm_component_with_timeout(component, instance, store, wit_settings).await;

        let execution_result = match timeout_result {
            Ok(result) => result,
            Err(elapsed) => {
                anyhow::bail!(
                    "Component {component_id} timed out after {}ms. Terminating...",
                    elapsed.as_millis()
                );
            }
        };

        match execution_result {
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

fn update_latest_votes(
    latest_votes: &mut HashMap<u32, VotedFeedUpdate>,
    batch: Vec<DataFeedPayload>,
) {
    for vote in batch {
        let feed_id = vote.payload_metadata.feed_id.parse().unwrap();

        if let Ok(value) = vote.result {
            _ = latest_votes.insert(
                feed_id,
                VotedFeedUpdate {
                    feed_id,
                    value,
                    end_slot_timestamp: vote.payload_metadata.timestamp,
                },
            );
        }
    }
}

async fn execute_wasm_component_with_timeout(
    component: &Component,
    instance: BlocksenseOracle,
    mut store: Store<HttpRuntimeData>,
    wit_settings: oracle::Settings,
) -> Result<wasmtime::Result<Result<Payload, Error>>, Duration> {
    tracing::trace!("Calling handle oracle request for `{}`", component.id);

    let start_time = Instant::now();

    let deadline = start_time + Duration::from_secs(component.interval_time_in_seconds);
    store.set_deadline(deadline);

    let timeout_result = tokio::task::spawn_blocking(move || {
        let local_runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("Failed to create a dedicated Tokio runtime for guest call");

        local_runtime.block_on(async move {
            let wasm_exec_fut = instance.call_handle_oracle_request(&mut store, &wit_settings);
            let result = timeout_at(deadline.into(), wasm_exec_fut).await;

            result.map_err(|_| Instant::now() - start_time)
        })
    })
    .await
    .unwrap();

    let elapsed_time_ms = start_time.elapsed().as_millis();
    tracing::trace!(
        "Oracle request for `{}` completed in {elapsed_time_ms}ms",
        component.id
    );
    REPORTER_WASM_EXECUTION_TIME_GAUGE
        .with_label_values(&[&component.id.clone()])
        .set(elapsed_time_ms as i64);

    timeout_result
}
