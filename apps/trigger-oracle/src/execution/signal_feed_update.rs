use std::{collections::HashSet, sync::Arc, time::Duration};

use blocksense_feed_registry::{registry::SlotTimeTracker, types::Repeatability};
use tokio::sync::{Mutex, Notify};

use crate::DataFeedSetting;

pub struct FeedUpdateSignallerState {
    pub component_id: String,
    pub notify: Arc<Notify>,
    pub settings_per_signal: HashSet<DataFeedSetting>,
    pub settings_union: Arc<Mutex<HashSet<DataFeedSetting>>>,
    pub signal_interval: Duration,
}

// TODO(xearty): Name this signal emitter?
pub async fn feed_update_signaller(state: FeedUpdateSignallerState) {
    let time_tracker = SlotTimeTracker::new(
        format!("feed_update_signaller_{}", state.component_id),
        state.signal_interval,
        0,
    );

    loop {
        let mut settings_union = state.settings_union.lock().await;

        *settings_union = settings_union
            .union(&state.settings_per_signal)
            .cloned()
            .collect();

        state.notify.notify_one();
        drop(settings_union);

        time_tracker
            .await_end_of_current_slot(&Repeatability::Periodic)
            .await;
    }
}
