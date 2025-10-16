use alloy::{
    pubsub::{ConnectionHandle, PubSubConnect},
    transports::{ws::WsConnect, TransportResult},
};
use async_trait::async_trait;
use blocksense_config::WebsocketReconnectConfig;
use std::sync::Arc;
use tokio::time::{sleep, Duration};
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

            match PubSubConnect::connect(&self.inner).await {
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
                    sleep(delay).await;
                }
            }
        }
    }
}
