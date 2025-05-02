use blocksense_metrics::metrics::{REPORTER_FAILED_WASM_EXECS, REPORTER_WASM_EXECUTION_TIME_GAUGE};
use outbound_http::OutboundHttpComponent;
use spin_trigger::TriggerAppEngine;
use std::{collections::HashSet, mem, sync::Arc, time::Instant};
use tokio::sync::{mpsc::UnboundedSender, Mutex, Notify};

use crate::{BlocksenseOracle, CapabilitySetting, DataFeedSetting, OracleTrigger, Payload};

pub struct FeedUpdateSignalListenerState {
    pub component_id: String,
    pub component_api_keys: Vec<CapabilitySetting>,
    pub notify: Arc<Notify>,
    pub settings_union: Arc<Mutex<HashSet<DataFeedSetting>>>,
    pub engine: Arc<TriggerAppEngine<OracleTrigger>>,
    pub payload_sender: UnboundedSender<(String, Payload)>,
}

pub async fn feed_update_signal_listener(state: FeedUpdateSignalListenerState) {
    loop {
        state.notify.notified().await;

        let settings_union = {
            let mut settings_union = state.settings_union.lock().await;
            mem::take(&mut *settings_union)
        };

        let execute_result = execute_component(
            &state.engine,
            &state.component_id,
            &state.component_api_keys,
            settings_union.into_iter().collect(),
        )
        .await;

        match execute_result {
            Ok(payload) => {
                tracing::trace!("Component `{}` executed successfully", state.component_id);
                send_payload_to_processor(&state.component_id, payload, &state.payload_sender);
            }
            Err(error) => {
                tracing::error!(
                    "Component - ({}) execution ended with error {}",
                    state.component_id,
                    error
                );
            }
        }
    }
}

async fn execute_component(
    engine: &TriggerAppEngine<OracleTrigger>,
    component_id: &str,
    component_api_keys: &[CapabilitySetting],
    feeds_to_execute: Vec<DataFeedSetting>,
) -> anyhow::Result<Payload> {
    tracing::trace!("Loading guest for `{component_id }`");

    // Load the guest...
    let (instance, mut store) = engine.prepare_instance(component_id).await?;
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
        store.as_mut().data_mut().as_mut().allowed_hosts = outbound_http_data.allowed_hosts.clone();
    }

    // ...and call the entry point
    tracing::trace!(
        "Triggering application: {}; component_id: {component_id}",
        &engine.app_name
    );

    let wit_settings = crate::oracle::Settings {
        data_feeds: feeds_to_execute
            .into_iter()
            .map(|feed| crate::oracle::DataFeed {
                id: feed.id,
                data: feed.data,
            })
            .collect(),
        capabilities: component_api_keys
            .iter()
            .cloned()
            .map(|capability| crate::oracle::Capability {
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
        .with_label_values(&[component_id])
        .set(elapsed_time_ms as i64);

    match result {
        Ok(Ok(payload)) => {
            tracing::info!("Component {component_id} completed okay");
            // TODO(stanm): increment metric for successful executions

            Ok(payload)
        }
        Ok(Err(e)) => {
            tracing::warn!("Component {component_id} returned error {e:?}");
            REPORTER_FAILED_WASM_EXECS
                .with_label_values(&[component_id])
                .inc();
            Err(anyhow::anyhow!("Component {component_id} returned error")) // TODO: more details when WIT provides them
        }
        Err(e) => {
            tracing::error!("error running component {component_id}: {e:?}");
            REPORTER_FAILED_WASM_EXECS
                .with_label_values(&[component_id])
                .inc();
            Err(anyhow::anyhow!("Error executing component {component_id}"))
        }
    }
}

fn send_payload_to_processor(
    component_id: &str,
    payload: Payload,
    payload_processor_send: &UnboundedSender<(String, Payload)>,
) {
    tracing::trace!("Sending update to sequencer for `{component_id}`...");
    match payload_processor_send.send((component_id.into(), payload)) {
        Ok(_) => tracing::trace!("Sent update to sequencer for `{component_id}`"),
        Err(err) => {
            tracing::error!("Failed to send update to sequencer for `{component_id}` due to {err}")
        }
    };
}
