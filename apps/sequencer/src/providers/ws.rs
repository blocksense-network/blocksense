use alloy::{
    pubsub::{ConnectionHandle, PubSubConnect},
    transports::{ws::WsConnect, TransportResult},
};
use async_trait::async_trait;
use blocksense_config::WebsocketReconnectConfig;
use std::{future::Future, sync::Arc};
#[cfg(not(test))]
use tokio::time::sleep;
use tokio::time::Duration;
use tracing::{info, warn};

#[async_trait]
pub trait WsReconnectMetrics: Send + Sync {
    async fn on_disconnect(&self);
    async fn on_attempt(&self);
    async fn on_success(&self);
}

#[derive(Debug, Clone)]
pub struct WsReconnectPolicy {
    initial: Duration,
    max: Duration,
    multiplier: f64,
}

impl WsReconnectPolicy {
    pub fn from_config(config: Option<&WebsocketReconnectConfig>) -> Self {
        let cfg = config.cloned().unwrap_or_default();
        let initial = Duration::from_millis(cfg.initial_backoff_ms);
        let max = Duration::from_millis(cfg.max_backoff_ms);
        let multiplier = cfg.backoff_multiplier;
        let clamped_initial = initial.min(max);
        Self {
            initial: clamped_initial,
            max,
            multiplier,
        }
    }

    pub fn backoff_delay(&self, attempt: u64) -> Duration {
        if attempt == 0 {
            return Duration::ZERO;
        }
        let exponent = (attempt - 1) as f64;
        let scaled = self.initial.mul_f64(self.multiplier.powf(exponent));
        scaled.min(self.max)
    }
}

impl Default for WsReconnectPolicy {
    fn default() -> Self {
        Self::from_config(None)
    }
}

#[derive(Clone)]
pub struct ResilientWsConnect {
    inner: WsConnect,
    policy: WsReconnectPolicy,
    metrics: Arc<dyn WsReconnectMetrics>,
    network: Arc<String>,
}

#[cfg(test)]
mod backoff_recorder {
    use std::{future::Future, sync::Arc, time::Duration};
    use tokio::sync::Mutex;

    tokio::task_local! {
        static RECORDER: Arc<Mutex<Vec<Duration>>>;
    }

    // Run fut with RECORDER set as task local var for the current task.
    pub(super) async fn with_recorder<F, R>(recorder: Arc<Mutex<Vec<Duration>>>, fut: F) -> R
    where
        F: Future<Output = R>,
    {
        RECORDER.scope(recorder, fut).await
    }

    pub(super) async fn record_backoff(delay: Duration) {
        if let Ok(recorder) = RECORDER.try_with(|r| r.clone()) {
            recorder.lock().await.push(delay);
        }
    }
}

impl ResilientWsConnect {
    pub fn new(
        inner: WsConnect,
        policy: WsReconnectPolicy,
        metrics: Arc<dyn WsReconnectMetrics>,
        network: &str,
    ) -> Self {
        Self {
            inner,
            policy,
            metrics,
            network: Arc::new(network.to_owned()),
        }
    }
}

impl PubSubConnect for ResilientWsConnect {
    fn is_local(&self) -> bool {
        self.inner.is_local()
    }

    async fn connect(&self) -> TransportResult<ConnectionHandle> {
        let inner = self.inner.clone();
        let handle = PubSubConnect::connect(&inner).await?;
        Ok(handle
            .with_max_retries(u32::MAX)
            .with_retry_interval(Duration::from_secs(0)))
    }

    async fn try_reconnect(&self) -> TransportResult<ConnectionHandle> {
        let inner = self.inner.clone();
        self.reconnect_loop(|| PubSubConnect::connect(&inner)).await
    }
}

impl ResilientWsConnect {
    async fn reconnect_loop<F, Fut>(&self, mut connect: F) -> TransportResult<ConnectionHandle>
    where
        F: FnMut() -> Fut + Send,
        Fut: Future<Output = TransportResult<ConnectionHandle>> + Send,
    {
        self.metrics.on_disconnect().await;

        warn!(
            network = self.network.as_str(),
            initial_backoff_ms = self.policy.initial.as_millis(),
            max_backoff_ms = self.policy.max.as_millis(),
            multiplier = self.policy.multiplier,
            "WS transport disconnected; starting exponential reconnect attempts"
        );

        let mut attempt: u64 = 0;
        loop {
            attempt = attempt.saturating_add(1);
            self.metrics.on_attempt().await;

            match connect().await {
                Ok(handle) => {
                    self.metrics.on_success().await;
                    info!(
                        network = self.network.as_str(),
                        attempt, "WS transport reconnected after {attempt} attempt(s)"
                    );
                    return Ok(handle
                        .with_max_retries(u32::MAX)
                        .with_retry_interval(Duration::from_secs(0)));
                }
                Err(err) => {
                    let delay = self.policy.backoff_delay(attempt);
                    warn!(
                        network = self.network.as_str(),
                        attempt,
                        backoff_ms = delay.as_millis(),
                        capped = delay == self.policy.max,
                        error = %err,
                        "WS reconnect attempt failed; will retry"
                    );
                    self.wait_before_retry(delay).await;
                }
            }
        }
    }

    #[cfg(not(test))]
    async fn wait_before_retry(&self, delay: Duration) {
        sleep(delay).await;
    }

    #[cfg(test)]
    async fn wait_before_retry(&self, delay: Duration) {
        backoff_recorder::record_backoff(delay).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy::transports::TransportErrorKind;
    use async_trait::async_trait;
    use std::{
        collections::VecDeque,
        sync::{
            atomic::{AtomicUsize, Ordering},
            Arc,
        },
    };
    use tokio::sync::Mutex;

    #[derive(Clone)]
    struct MockConnector {
        outcomes: Arc<Mutex<VecDeque<MockOutcome>>>,
        attempts: Arc<AtomicUsize>,
    }

    #[derive(Clone)]
    enum MockOutcome {
        Ok,
        Err(&'static str),
    }

    impl MockConnector {
        fn new(outcomes: Vec<MockOutcome>) -> Self {
            Self {
                outcomes: Arc::new(Mutex::new(outcomes.into())),
                attempts: Arc::new(AtomicUsize::new(0)),
            }
        }

        fn next(&self) -> impl Future<Output = TransportResult<ConnectionHandle>> + Send + 'static {
            let outcomes = Arc::clone(&self.outcomes);
            let attempts = Arc::clone(&self.attempts);
            async move {
                attempts.fetch_add(1, Ordering::SeqCst);
                let outcome = outcomes
                    .lock()
                    .await
                    .pop_front()
                    .expect("mock connector exhausted");
                match outcome {
                    MockOutcome::Ok => {
                        let (handle, _iface) = ConnectionHandle::new();
                        Ok(handle)
                    }
                    MockOutcome::Err(msg) => Err(TransportErrorKind::custom_str(msg)),
                }
            }
        }

        fn attempts(&self) -> usize {
            self.attempts.load(Ordering::SeqCst)
        }

        async fn remaining(&self) -> usize {
            self.outcomes.lock().await.len()
        }
    }

    #[derive(Default)]
    struct RecordingMetrics {
        disconnects: AtomicUsize,
        attempts: AtomicUsize,
        successes: AtomicUsize,
        order: Mutex<Vec<&'static str>>,
    }

    impl RecordingMetrics {
        fn counts(&self) -> (usize, usize, usize) {
            (
                self.disconnects.load(Ordering::SeqCst),
                self.attempts.load(Ordering::SeqCst),
                self.successes.load(Ordering::SeqCst),
            )
        }

        async fn events(&self) -> Vec<&'static str> {
            self.order.lock().await.clone()
        }
    }

    #[async_trait]
    impl WsReconnectMetrics for RecordingMetrics {
        async fn on_disconnect(&self) {
            self.disconnects.fetch_add(1, Ordering::SeqCst);
            self.order.lock().await.push("disconnect");
        }

        async fn on_attempt(&self) {
            self.attempts.fetch_add(1, Ordering::SeqCst);
            self.order.lock().await.push("attempt");
        }

        async fn on_success(&self) {
            self.successes.fetch_add(1, Ordering::SeqCst);
            self.order.lock().await.push("success");
        }
    }

    #[test]
    fn backoff_delay_scales_and_caps() {
        let cfg = WebsocketReconnectConfig {
            initial_backoff_ms: 100,
            backoff_multiplier: 2.0,
            max_backoff_ms: 350,
        };
        let policy = WsReconnectPolicy::from_config(Some(&cfg));

        assert_eq!(policy.backoff_delay(0), Duration::ZERO);
        assert_eq!(policy.backoff_delay(1), Duration::from_millis(100));
        assert_eq!(policy.backoff_delay(2), Duration::from_millis(200));
        assert_eq!(policy.backoff_delay(3), Duration::from_millis(350));
        assert_eq!(policy.backoff_delay(4), Duration::from_millis(350));
    }

    #[tokio::test]
    async fn reconnect_loop_retries_metrics_and_stops_after_success() {
        let cfg = WebsocketReconnectConfig {
            initial_backoff_ms: 100,
            backoff_multiplier: 2.0,
            max_backoff_ms: 350,
        };
        let policy = WsReconnectPolicy::from_config(Some(&cfg));
        let metrics = Arc::new(RecordingMetrics::default());
        let connector = MockConnector::new(vec![
            MockOutcome::Err("fail-1"),
            MockOutcome::Err("fail-2"),
            MockOutcome::Ok,
            MockOutcome::Err("unused"),
        ]);

        let recorded_delays = Arc::new(Mutex::new(Vec::new()));
        let resilient = ResilientWsConnect::new(
            WsConnect::new("ws://example.invalid"),
            policy.clone(),
            metrics.clone(),
            "testnet",
        );

        let expected_delays = [policy.backoff_delay(1), policy.backoff_delay(2)];

        backoff_recorder::with_recorder(recorded_delays.clone(), async {
            let connector_for_task = connector.clone();
            let resilient_for_task = resilient.clone();
            let join = tokio::spawn(backoff_recorder::with_recorder(
                recorded_delays.clone(),
                async move {
                    resilient_for_task
                        .reconnect_loop(move || connector_for_task.next())
                        .await
                },
            ));

            let result = join.await.expect("task completed");
            let handle = result.expect("reconnect eventually succeeds");
            handle.shutdown();
        })
        .await;

        assert_eq!(connector.attempts(), 3);
        assert_eq!(connector.remaining().await, 1);

        let recorded = recorded_delays.lock().await.clone();
        assert_eq!(recorded, expected_delays.to_vec());

        let (disconnects, attempts, successes) = metrics.counts();
        assert_eq!(disconnects, 1);
        assert_eq!(attempts, 3);
        assert_eq!(successes, 1);

        let events = metrics.events().await;
        assert_eq!(
            events,
            vec!["disconnect", "attempt", "attempt", "attempt", "success"]
        );
    }
}
