mod feed_update_signal_listener;
mod payload_processor;
mod signal_feed_update;

use spin_trigger::TriggerAppEngine;
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
    time::Duration,
};
use tokio::{
    sync::{
        mpsc::{self, UnboundedSender},
        Mutex, Notify,
    },
    task::JoinSet,
};
use url::Url;

use crate::{
    execution::{
        feed_update_signal_listener::{feed_update_signal_listener, FeedUpdateSignalListenerState},
        payload_processor::process_payload,
        signal_feed_update::{feed_update_signaller, FeedUpdateSignallerState},
    },
    Component, DataFeedResults, OracleTrigger, Payload,
};

pub fn schedule_execution_tasks(
    join_set: &mut JoinSet<()>,
    engine: Arc<TriggerAppEngine<OracleTrigger>>,
    sequencer_url: Url,
    secret_key: String,
    reporter_id: u64,
    components: HashMap<String, Component>,
    latest_votes: DataFeedResults,
) {
    let (payload_sender, payload_receiver) = mpsc::unbounded_channel();

    join_set.spawn(process_payload(
        payload_receiver,
        latest_votes,
        sequencer_url.join("/post_reports_batch").unwrap(),
        secret_key,
        reporter_id,
    ));

    components.into_values().for_each(|component| {
        schedule_execution_tasks_for_component(
            join_set,
            engine.clone(),
            &component,
            payload_sender.clone(),
        );
    });
}

pub fn schedule_execution_tasks_for_component(
    join_set: &mut JoinSet<()>,
    engine: Arc<TriggerAppEngine<OracleTrigger>>,
    component: &Component,
    payload_processor_sender: UnboundedSender<(String, Payload)>,
) {
    let signal_notify = Arc::new(Notify::new());
    let settings_union = Arc::new(Mutex::new(HashSet::new()));

    join_set.spawn(feed_update_signaller(FeedUpdateSignallerState {
        component_id: component.id.clone(),
        notify: signal_notify.clone(),
        settings_per_signal: component.oracle_settings.clone(),
        settings_union: settings_union.clone(),
        signal_interval: Duration::from_secs(component.interval_time_in_seconds),
    }));

    join_set.spawn(feed_update_signal_listener(FeedUpdateSignalListenerState {
        component_id: component.id.clone(),
        notify: signal_notify,
        component_api_keys: component.capabilities.clone(),
        settings_union,
        engine,
        payload_sender: payload_processor_sender,
    }));
}
