# Reorg Tracking

This document describes how `apps/sequencer/src/providers/reorg_tracking.rs` monitors
canonical chain progress, detects reorganizations, and recovers the Sequencer’s
state.

## Tracker State and Inputs

- `ReorgTracker` keeps per-network state: the most recent finalized height,
  the highest height we have observed locally, an iteration counter, and the
  RPC timeout derived from `ReorgConfig`.
- Access to providers is shared via `SharedRpcProviders`, where each
  `RpcProvider` owns the HTTP transport, optional websocket transport, and an
  `InflightObservations` cache (`observed_block_hashes` plus
  `non_finalized_updates`).
- Reintroduced batches are sent through a `CountedSender<BatchOfUpdatesToProcess>`
  so the relayer loop can replay messages that were lost on a fork.
- When websocket support is configured (`Provider.websocket_url` with optional
  `WebsocketReconnectConfig`) the tracker builds a `ResilientWsConnect` to
  subscribe to `eth_subscribe:newHeads`.

## Control Loop (`loop_tracking_for_reorg_in_network`)

1. **Transport setup** – If a websocket URL is present we attempt to connect
   and subscribe to `newHeads`. The handshake and subsequent reconnects use the
   `WsReconnectPolicy` backoff helpers (`should_attempt_ws`, `schedule_ws_retry`,
   `reset_ws_backoff`). On failure the tracker logs the reason, schedules a
   retry, and temporarily falls back to HTTP polling.
2. **Polling cadence** – For pure HTTP operation we call
   `calculate_block_generation_time_in_network` (look back 100 blocks) to
   estimate the poll interval. All block reads are wrapped in
   `actix_web::rt::time::timeout`; warnings are emitted when a 5‑second deadline
   is exceeded.
3. **Per-iteration work** – Each loop iteration:
   - Clones the provider handle and a snapshot of `observed_block_hashes`.
   - Selects the websocket provider when available (HTTP otherwise) for reads.
   - Fetches the latest head (`BlockNumberOrTag::Latest`) and, if successful,
     passes it to `process_new_block`.
   - Reads the on-chain ADFS root via `rpc_get_storage_at`. If the storage slot
     differs from the locally tracked Merkle root we update
     `RpcProvider.merkle_root_in_contract` and mark that the ring buffer indices
     must be resynchronized.
   - Fetches `BlockNumberOrTag::Finalized` to advance
     `observer_finalized_height`. When finalization moves forward we prune both
     `non_finalized_updates` and `observed_block_hashes` through
     `InflightObservations::prune_observed_up_to`. If the tracker falls behind
     finalization we reset `observed_latest_height` to the finalized height and
     seed the observed hash from the finalized block.
   - When `need_resync_indices` is true we call `try_to_sync` so the ring-buffer
     indices are refreshed directly from the contract state.
   - If the provider disappears from the shared map we log and terminate the
     loop for that network.

## Detecting Divergence (`process_new_block`)

- **Tip pre-check** – Before ingesting new blocks we refetch the chain block at
  `observed_latest_height`. A hash mismatch signals that the tracked tip was
  replaced, so we increment `ProviderMetrics.observed_reorgs` and delegate to
  `handle_reorg`.
- **Parent mismatch** – When new blocks appear we load the first new block and
  compare its parent hash to the stored hash for `observed_latest_height`. Any
  difference indicates a fork at or above that height.
- **Same-height hash change** – Even if the height does not advance, the latest
  header fetched from RPC is compared with the cached hash. If it changes we
  treat it as a reorg.
- Successful ingestion stores fresh hashes in
  `provider.inflight.observed_block_hashes` for every block seen, ensuring we
  can later walk backwards to locate a common ancestor.

All block and storage reads funnel through `rpc_get_block_by_number` and
`rpc_get_storage_at`. These helpers prefer the websocket provider when it is
healthy and fall back to HTTP otherwise, still enforcing the per-call timeout.

## Handling a Reorg (`handle_reorg`)

1. Walk the cached heights in descending order (starting from the newest cached
   block) and refetch each block from the chain until we locate the first height
   where the stored hash matches the canonical hash. The function logs any
   diverged heights it sees along the way.
2. The fork point is `first_common + 1`. We log both the ancestor and the fork
   height for operators.
3. Holding the provider lock, we remove every entry in
   `non_finalized_updates` with a height ≥ fork height. Each batch is sent back
   to the relayer channel in ascending order and the resend outcome is logged.
   Pre-fork entries stay untouched so they can be
   pruned only when the network finalizes them.
4. If no common ancestor is found within the cached history we warn, but the
   loop continues on the canonical head revealed by RPC.

## Finalization and Cleanup

- `observer_finalized_height` tracks the latest finalized block we have seen.
  Advancing it triggers a pruning pass in `InflightObservations` which clears
  outdated block hashes and relayer batches that can never reorg again.
- If we discover that `observed_latest_height` lags behind finalization we
  fast-forward it to the finalized height and overwrite the cached hash to keep
  the tracker anchored to known-final data.
- Additional blocks observed after a fork are appended to
  `observed_block_hashes`, giving the tracker the history it needs for future
  reorg detection.

## Websocket Strategy and Fallbacks

- When websockets are configured the tracker continuously consumes the
  `newHeads` stream. Every received header simply wakes the loop so the same
  verification logic runs against HTTP (to reuse existing RPC primitives).
- Disconnects or subscription failures trigger a configurable backoff sequence.
  While waiting for the next retry we revert to the polling cadence determined
  by the average block time.
- If no websocket URL is configured we never try to connect; the loop purely
  relies on the adaptive polling interval.

## Metrics and Observability

- `ProviderMetrics.observed_reorgs` (an `IntCounterVec` keyed by network) is the
  primary signal that a reorg was detected. Every detection increments it before
  the corrective flow begins.
- Logs include network, observed/latest heights, finalized checkpoints, and
  loop counters, mirroring the legacy `eth_send_utils` diagnostics so existing
  dashboards remain useful. Diverged block hashes, fork points, and resend
  activity are explicitly printed.

## Test Coverage

- `test_loop_tracking_reorg_detect_and_resync_indices_http` and
  `test_loop_tracking_reorg_detect_and_resync_indices_websock`
  (`apps/sequencer/src/providers/reorg_tracking.rs:1573`) spin up an Anvil node,
  inject synthetic non-finalized batches (tagged via `EncodedFeedId`), and drive
  a deterministic reorg using snapshot/revert.
- The tests assert that:
  - `observed_reorgs` increments for the network.
  - Only the batches at or above the fork height are replayed through the
    relayer channel and they arrive in ascending order.
  - Pre-fork batches remain cached until later finalization causes pruning.
  - The on-chain ADFS root drift triggers a `try_to_sync` resync, even without
    deploying contracts.
  - Both the HTTP polling path and websocket-triggered path exercise the same
    logic by running the scenario twice.

Together these pieces ensure the Sequencer can withstand short-lived forks,
recover the state required to keep publishing updates, and provide operators the
signals they need to observe the system’s behavior.
