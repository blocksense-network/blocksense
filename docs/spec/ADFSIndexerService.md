Below is a complete, implementation-ready **software specification** for your multichain EVM indexing service built with **Node.js + TypeScript + Effect** and **viem**, persisting into **PostgreSQL**. It encodes all choices you provided; unspecified areas use clearly marked defaults that you can change before coding.

---

# 0) Executive summary

**Goal.** Index a single ADFS contract (behind an upgradable proxy) per chain across multiple chains, listen to one event topic, and for every emission:

- fetch the **transaction input data**,
- **decode** it via `decodeADFSCalldata()`,
- persist raw + normalized records into **Postgres**,
- maintain **latest-per-(chainId, feedId, stride)** materialization, with an option to show only feeds updated in the past X days,
- support **historical backfill** from each contract’s deployment block,
- handle **finality/reorgs** with a `pending → confirmed` state machine and soft deletes,
- support **contract versioning** with a `version` column and an `extra` JSONB column.

**Consumers.** Other services sync from the DB. Read-only DB role is provided.

---

# 1) Functional requirements

### 1.1 Chains & contracts

- **Multichain**: run for a configurable set of chains concurrently.
- **Per chain**: exactly **one** target ADFS proxy/contract to monitor.
- **Backfill**: from the **contract deployment block** (`startBlock`) inclusive.
- **Live tail**: subscribe via WS, process logs in **block order** per chain.
- **Finality**: confirmations per chain are **configurable** and stored in config.
- **Reorgs**: soft‑delete semantics via state transitions (see §5).

### 1.2 Events & decoding

- **Event topic**: configured as `topicName` (raw event signature, e.g., "DataFeedsUpdated(uint256)"). The service derives `topic0 = keccak256(topicName)` internally for filters.
- **Tx input**: fetch for each matched log; decode using `decodeADFSCalldata(calldata, hasBlockNumber)`:

  - The service decides `hasBlockNumber` **by contract version**, not config.

- **Decoded structure** (you provided):

  - `feeds[]` items expose `stride`, `feedIndex`, and **always** `feedId` (u128) and `index` (u16), plus `data` (bytes).
  - `ringBufferTable[]` items expose `index` (global table index) and `data` (bytes).

- **Source of truth for block number**: **event data**.
- **Multiple ADFS versions**: DB includes a `version` column; per‑version extra data goes into `extra` (JSONB).

### 1.3 Queries consumers must support (day‑1)

- Get **latest** value for `(chainId, feedId, stride)`.
- Get **all updates** for `(chainId, feedId)` in **block range** `[A, B]`.
- Random access: lookup **ring buffer slot contents** by `(chainId, feedId, index, stride)` (see §4.4 on mapping).
- Only **confirmed** rows appear in the latest view/table.
- List **active feeds**: latest entries where `block_timestamp ≥ now() - interval 'X days'` for a given `chainId` (optional filter).

---

# 2) Non‑functional requirements

- **Throughput**: \~**1–2 tx per block** aggregate per chain.
- **Ordering**: **strict blockNumber+logIndex order** within a chain; cross‑chain runs in parallel.
- **Idempotency**: unique natural key `(chain_id, tx_hash, log_index)` with **UPSERT**.
- **DB**: PostgreSQL; partition **by chain** and **monthly** sub‑partitions.
- **Availability**: separate DBs per env (`devnet`, `testnet`, `mainnet`).
- **Security**: Tailscale network; secrets via **env**.
- **Observability**: Prometheus metrics; Grafana dashboards; JSON logs; OpenTelemetry tracing (endpoint to be provided).
- **Limits/guards**:

  - Bounded in‑memory queue per chain with **drop‑oldest** (configurable size).

---

# 3) Architecture

```
+------------------+       +------------------+       +-------------------+
|   Config (JSON)  |       |  Env (secrets)   |       |   Grafana/Prom    |
+---------+--------+       +---------+--------+       +---------+---------+
          |                          |                          ^
          v                          v                          |
+---------+------------------------------------------------------+-----+
|                     Indexer Process (Effect runtime)                 |
|                                                                      |
|  Layers:                                                             |
|  - ConfigLayer       (JSON -> types, no hot reload)                  |
|  - RpcLayer          (viem clients: HTTP + WS)                       |
|  - DbLayer           (Postgres pool)                                 |
|  - MetricsLayer      (Effect tracing spans → Prom exporter)          |
|  - LogLayer          (JSON logs)                                     |
|  - TracingLayer      (Effect metrics counters)                       |
|                                                                      |
|  Supervisors:                                                        |
|  - ChainRuntime[chain]                                               |
|     * BackfillWorker (HTTP getLogs)                                  |
|     * LiveTailWorker (WS watchEvent)                                 |
|     * ProxyUpgradeWatcher (WS/HTTP)                                  |
|     * BlockHeaderCache (HTTP)                                        |
|     * OrderingBuffer (per-chain)                                     |
|     * Writer (per-block DB tx)                                       |
+----------------------------------------------------------------------+
          |
          v
+----------------------------+
|        PostgreSQL          |
|  (separate per env)        |
+----------------------------+
```

### 3.1 Process model

- **Configurable**: run **multichain** in one process **or** one process **per chain** (flag).
- **Effect** supervisors restart failed fibers with backoff.

### 3.2 RPC usage (viem)

- **WS**: subscribe using `topic0 = keccak256(topicName)` for the proxy/contract (live tail).
- **HTTP**: backfill ranges + `getTransaction` for calldata; `getBlock` for timestamp/hash.
- **Proxy upgrade**: watch **TransparentUpgradeableProxy** `Upgraded(address)` logs from the proxy address and bump `version`.

---

# 4) Data model (PostgreSQL)

All binary data uses **BYTEA**. Addresses are stored as 20‑byte `BYTEA`. Timestamps as `TIMESTAMPTZ`. Integers:

- `feed_id`: **BIT(128)** (per your choice).
- `rb_index` (ring buffer index **within feed**): `SMALLINT` (u16).
- Global `ring_buffer_table_index`: `BIGINT`.
- `stride`: `SMALLINT`.
- `block_number`: `BIGINT`.

Partitioning:

- Parent tables are **PARTITION BY LIST (chain_id)**; children are **SUBPARTITION BY RANGE (block_timestamp)** with **monthly** partitions.

> **State model:** `pending`, `confirmed`, `dropped`.
> Once a row is `confirmed`, it never becomes `dropped`.

### 4.1 Core tables (DDL sketch)

```sql
-- CHAIN METADATA -------------------------------------------------------
CREATE TABLE chains (
  chain_id        INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  finality_conf   INTEGER NOT NULL  -- confirmations
);

-- CONTRACTS & PROXY VERSIONS ------------------------------------------
CREATE TABLE contracts (
  chain_id        INTEGER REFERENCES chains(chain_id),
  proxy_address   BYTEA NOT NULL,             -- 20 bytes
  contract_address BYTEA NOT NULL,            -- current impl (optional if desired)
  topic_hash      BYTEA NOT NULL,             -- 32 bytes; keccak256(topicName) stored in DB
  start_block     BIGINT NOT NULL,
  UNIQUE (chain_id)
);

CREATE TABLE proxy_versions (
  chain_id        INTEGER NOT NULL REFERENCES chains(chain_id),
  version         INTEGER NOT NULL,
  implementation  BYTEA NOT NULL,             -- 20 bytes
  activated_block BIGINT NOT NULL,
  PRIMARY KEY (chain_id, version)
);

-- RAW EVENTS / TX INPUTS ----------------------------------------------
CREATE TABLE adfs_events (
  chain_id        INTEGER NOT NULL,
  block_number    BIGINT  NOT NULL,
  block_hash      BYTEA   NOT NULL,           -- 32 bytes
  block_timestamp TIMESTAMPTZ NOT NULL,
  tx_hash         BYTEA   NOT NULL,           -- 32 bytes
  log_index       INTEGER NOT NULL,
  topic_hash      BYTEA   NOT NULL,           -- topic0; derived from `topicName` (redundancy for audit)
  status          TEXT    NOT NULL CHECK (status IN ('pending','confirmed','dropped')),
  version         INTEGER NOT NULL,           -- per proxy version at emission
  calldata        BYTEA   NOT NULL,           -- raw tx input
  has_block_number BOOLEAN NOT NULL,          -- derived by version
  extra           JSONB   NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (chain_id, tx_hash, log_index)
) PARTITION BY LIST (chain_id);

-- child partitions per chain, each SUBPARTITION BY RANGE (block_timestamp)
-- e.g., adfs_events_chain_1 PARTITION OF adfs_events FOR VALUES IN (1)
--       PARTITION BY RANGE (block_timestamp);
--       adfs_events_chain_1_2025_09 ... etc.

-- FEED UPDATES (normalized, one row per feed entry) -------------------
CREATE TABLE feed_updates (
  chain_id        INTEGER NOT NULL,
  block_number    BIGINT  NOT NULL,
  block_hash      BYTEA   NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  tx_hash         BYTEA   NOT NULL,
  log_index       INTEGER NOT NULL,
  status          TEXT    NOT NULL CHECK (status IN ('pending','confirmed','dropped')),
  version         INTEGER NOT NULL,
  stride          SMALLINT NOT NULL,
  feed_id         BIT(128) NOT NULL,
  rb_index        SMALLINT NOT NULL,          -- ring buffer index within feed (u16)
  data            BYTEA NOT NULL,
  extra           JSONB   NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (chain_id, tx_hash, log_index, feed_id, stride, rb_index)
) PARTITION BY LIST (chain_id);

CREATE INDEX feed_updates_idx_latest
  ON feed_updates (chain_id, feed_id, stride, block_number DESC, log_index DESC)
  INCLUDE (status);

-- RING BUFFER GLOBAL TABLE WRITES -------------------------------------
CREATE TABLE ring_buffer_writes (
  chain_id        INTEGER NOT NULL,
  block_number    BIGINT  NOT NULL,
  block_hash      BYTEA   NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  tx_hash         BYTEA   NOT NULL,
  log_index       INTEGER NOT NULL,
  status          TEXT    NOT NULL CHECK (status IN ('pending','confirmed','dropped')),
  version         INTEGER NOT NULL,
  table_index     BIGINT  NOT NULL,           -- global ring buffer table index
  data            BYTEA NOT NULL,
  extra           JSONB   NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (chain_id, tx_hash, log_index, table_index)
) PARTITION BY LIST (chain_id);

CREATE INDEX ring_buffer_writes_idx
  ON ring_buffer_writes (chain_id, table_index, block_number DESC);

-- LATEST MATERIALIZATION (confirmed only) ------------------------------
CREATE TABLE feed_latest (
  chain_id        INTEGER NOT NULL,
  feed_id         BIT(128) NOT NULL,
  stride          SMALLINT NOT NULL,
  block_number    BIGINT  NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  block_hash      BYTEA   NOT NULL,
  tx_hash         BYTEA   NOT NULL,
  log_index       INTEGER NOT NULL,
  rb_index        SMALLINT NOT NULL,
  data            BYTEA NOT NULL,
  version         INTEGER NOT NULL,
  PRIMARY KEY (chain_id, feed_id, stride)
);

-- Optional index to support "active since X days" queries
CREATE INDEX feed_latest_active_since_idx
  ON feed_latest (chain_id, block_timestamp DESC);

-- PROCESSING CURSORS ---------------------------------------------------
CREATE TABLE processing_state (
  chain_id             INTEGER PRIMARY KEY,
  last_seen_block      BIGINT NOT NULL DEFAULT 0,    -- tip of what we've observed
  last_finalized_block BIGINT NOT NULL DEFAULT 0,    -- tip safe at N confirmations
  last_backfill_block  BIGINT NOT NULL DEFAULT 0     -- progress pointer for backfill
);
```

> **Primary keys:** We keep **surrogate IDs** implicit by the composite PKs; if you prefer numerical `BIGSERIAL id`, add it while preserving unique constraints.
> **Block hash storage** (`BYTEA`) enables audit and fork tracing.

### 4.2 State machine

- New rows enter as `pending`.
- When the block reaches **N confirmations** (from `chains.finality_conf`), rows flip to `confirmed`.
- If a `pending` log disappears due to reorg, flip to `dropped`.
  **Confirmed rows never become dropped.**

### 4.3 Latest maintenance

- On **confirm** of a `feed_updates` row, perform an **UPSERT** into `feed_latest` keyed by `(chain_id, feed_id, stride)`, choosing the max `(block_number, log_index, rb_index)` if there’s contention.
- `feed_latest` contains **confirmed rows only** and stores the last `block_timestamp` for recency filters.
- Consumers may apply an optional "active since X days" filter using `block_timestamp ≥ now() - interval 'X days'`.

### 4.4 Ring buffer addressing (for random reads)

- Given `(feedId, stride)`, compute the global **table index**:

  ```
  table_index = (2 ** 115 * stride + feedId) / 16
  ```

- To support **random historical reads**, queries compute that `table_index` and look up in `ring_buffer_writes (table_index)`.
- We index `ring_buffer_writes` on `(chain_id, table_index, block_number DESC)` to get newest‑first results for any slot.

---

# 5) Reorg & finality policy

- **Uniqueness key**: `(chain_id, tx_hash, log_index)`.
- **Pending window**: rows remain `pending` until confirmed depth is reached.
- **Reorg handling**:

  - Do **not** replay from common ancestor.
  - Instead, mark disappeared `pending` rows as `dropped`. Live tail will emit the canonical logs, which we’ll insert separately.

- **Max reorg depth**: implied by configured finality; no extra guard needed.
- **Per‑chain confirmations** are sourced from config and stored in `chains`.

---

# 6) Ingestion & ordering

- **Concurrency**:

  - Parallel **by chain**.
  - Within a chain, maintain strict **blockNumber & logIndex** order. Out‑of‑order WS events are buffered briefly.

- **Backfill**:

  - One **backfill worker per chain** scanning `getLogs` from `startBlock` with adaptive ranges (initial span pulled from config, defaulting to 10k blocks; shrink on RPC errors).
  - Backfill and live tail run concurrently; the writer enforces ordering.

- **DB writes**:

  - **One DB transaction per block per chain**.
  - `UPSERT` everywhere to ensure idempotency.

- **Batching defaults**:

  - `db_write_batch_rows`: **200** rows per insert/UPSERT statement (configurable).

- **Backpressure**:

  - Per‑chain bounded queue with **drop‑oldest (pending only)**.
  - `queue_max_items`: **10,000** (default; configurable).

---

# 7) Versioning via proxy upgrades

- **Watch** the proxy’s `Upgraded(address implementation)` event; each emission increments `version` for that `chain_id`.
- Service maintains a **VersionRegistry** mapping `{chain_id → current version, impl address, activated_block}` persisted in `proxy_versions`.
- `hasBlockNumber` is **derived** by version (no config flag).
  Provide a **code map**:

```ts
const VersionMode: Record<number, { hasBlockNumber: boolean }> = {
  1: { hasBlockNumber: true },
  2: { hasBlockNumber: false },
  // extend as new versions ship
};
```

- When processing a log, look up the **active version at that block** to set `version` and `hasBlockNumber`, then call the decoder accordingly.

---

# 8) Configuration

**Format**: **JSON file**, **no hot reload**.
**Secrets** via **env** (DB URL, RPC keys).
**Separate config files** per environment; **separate Postgres databases**.

### 8.1 JSON schema (logical)

```json
{
  "service": {
    "queueMaxItems": 10000, // default; drop-oldest policy
    "dbWriteBatchRows": 200,
    "metricsPort": 9464 // HTTP :metricsPort/metrics exporter
  },
  "chains": [
    {
      "chainId": 1,
      "name": "ethereum",
      "rpcHttp": ["https://.../"], // fallback order
      "rpcWs": ["wss://.../"],
      "finality": 12,
      "contractAddress": "0xProxyAddress", // proxy
      "topicName": "DataFeedsUpdated(uint256)",
      "startBlock": 12345678,
      "alertsConfig": { "noEventsSeconds": 300, "maxLagBlocks": 64 }
    }
    // more chains...
  ]
}
```

> `hasBlockNumber` **not** in config (derived by version).
> Provide HTTP/WS RPC endpoints as arrays in priority order; the service tries each until one succeeds.
> **Rate limits** and **max queue size** are optional config knobs; defaults provided.
> `topicName` is a config-only field; the database persists only the computed hash (`topic0`) as `BYTEA` (e.g., `chains.topic_hash`, `contracts.topic_hash`, `events_adfs.topic0`).
> Embed any provider API keys directly in the RPC URLs; no extra env indirection.
> Live tailing will fall back to HTTP polling against the `rpcHttp` list whenever all WS endpoints are unavailable.
> Per-chain `alertsConfig` thresholds drive "no events" and "lag" alert timing; tune them to the expected update cadence.
> Prometheus metrics are served from `http://0.0.0.0:${service.metricsPort}/metrics`.

**Env variables**:

- `PG_URL` (writer)
- `OTEL_EXPORTER_OTLP_ENDPOINT` (when provided)
- `LOG_LEVEL` (`info` default)

---

# 9) Effect runtime design (Node + TS)

### 9.1 Layers

- **ConfigLayer**: parses JSON, validates against schema.
- **RpcLayer**: builds per-chain viem clients (`publicClient` HTTP + `webSocketClient`) with fallback selection across configured endpoint arrays.
- **DbLayer**: `pg` pool with tuned pool size; exposes repo methods (idempotent UPSERTs).
- **MetricsLayer**: wraps `Effect.Tracing` instrumentation (see Effect observability docs) to create spans around pipeline stages, derives latency metrics from span data, and exposes them via a Prometheus `/metrics` endpoint bound to `service.metricsPort`.
- **LogLayer**: JSON structured logging (`pino` or `console` wrapper).
- **TracingLayer**: uses `Effect.Metric` primitives to register counters/histograms (ingest lag, error rates) and exports them to OTLP/Prom sinks configured by the metrics module.

  Reference: Effect observability guides — tracing (`https://effect.website/docs/observability/tracing/`) for span instrumentation powering the MetricsLayer, and metrics (`https://effect.website/docs/observability/metrics/`) for the TracingLayer data-plane counters.

### 9.2 Fibers per chain

- **BackfillWorker**: walks historical block ranges via `eth_getLogs`, starting from the chain’s `startBlock` up to `head − finality`. It adapts the range size based on RPC failures, hydrates missing tx/block metadata, decodes payloads, and forwards normalized rows to the OrderingBuffer while emitting tracing spans for range latency.
- **LiveTailWorker**: uses viem’s `watchEvent` WebSocket helper to stream new `DataFeedsUpdated` logs; it automatically handles resubscription/backoff and, when WS connectivity becomes unavailable, falls back to HTTP polling (`getLogs`) through the configured `rpcHttp` fallback list to keep tailing until WS recovers. For each live log it fetches tx input + block header when absent, enriches with version metadata, and publishes decoded results into the shared OrderingBuffer with causality metadata.
- **ProxyUpgradeWatcher**: watches the proxy’s `Upgraded` topic (both WS and catch-up HTTP) to detect implementation changes. It persists `contract_versions`, bumps the in-memory VersionManager, and backfills any missed upgrades so the decoder always uses the correct ABI.
- **OrderingBuffer**: merges the backfill and live streams in `(block_number, log_index)` order. It buffers gaps within configured bounds, drops only oldest pending data on overflow, and surfaces queue depth metrics so operators can tune throughput.
- **Writer**: drains ordered batches per block, executes a single UPSERT-heavy transaction to populate `adfs_events`, `feed_updates`, `ring_buffer_writes`, and `feed_latest`, and flips `pending → confirmed/dropped` once finality is satisfied. It also records success/error counters for observability.

---

# 10) Event processing flow

1. **Detect** matching log (`topic0 = keccak256(topicName)`, address = proxy/contract).
2. **Look up version** active at `block_number` (`proxy_versions`).
3. **Fetch** tx calldata (`getTransaction(txHash)`).
4. **Decode** via `decodeADFSCalldata(calldata, VersionMode[version].hasBlockNumber)`.
5. **Assemble rows**:

   - `adfs_events` (raw).
   - One or more `feed_updates` rows (for each `feeds[]` entry).
   - Zero or more `ring_buffer_writes` rows (for each `ringBufferTable[]` entry).

6. **Write** within a single **DB tx per block**:

   - Insert/UPSERT `adfs_events` (status `pending`).
   - Insert/UPSERT `feed_updates` (status `pending`).
   - Insert/UPSERT `ring_buffer_writes` (status `pending`).

7. **Finality loop**:

   - Periodically compute `last_finalized_block = head - confirmations`.
   - For all `pending` rows with `block_number ≤ last_finalized_block`:

     - Flip to `confirmed`.
     - UPSERT into `feed_latest` (confirmed only).

   - For any `pending` rows invalidated by reorg: flip to `dropped` (no replay).

---

# 11) SQL: materialization & constraints

- **feed_latest** UPSERT:

```sql
INSERT INTO feed_latest AS fl
(chain_id, feed_id, stride, block_number, block_timestamp, block_hash, tx_hash, log_index, rb_index, data, version)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
ON CONFLICT (chain_id, feed_id, stride)
DO UPDATE SET
  block_number = EXCLUDED.block_number,
  block_timestamp = EXCLUDED.block_timestamp,
  block_hash   = EXCLUDED.block_hash,
  tx_hash      = EXCLUDED.tx_hash,
  log_index    = EXCLUDED.log_index,
  rb_index     = EXCLUDED.rb_index,
  data         = EXCLUDED.data,
  version      = EXCLUDED.version
WHERE (fl.block_number, fl.log_index, fl.rb_index)
    < (EXCLUDED.block_number, EXCLUDED.log_index, EXCLUDED.rb_index);
```

- **Idempotency**:

  - `adfs_events`: `PRIMARY KEY (chain_id, tx_hash, log_index)`.

- `feed_updates`: add composite PK including `feed_id` and `rb_index`.
  - `ring_buffer_writes`: PK includes `table_index`.

---

# 12) Observability & alerting

### 12.1 Metrics (Prometheus)

- `events_processed_total{chain,status}` — `status` reflects the `adfs_state` enum: `pending`, `confirmed`, or `dropped`.
- `events_lag_blocks{chain}` (head − last_seen_block)
- `finality_lag_blocks{chain}` (head − last_finalized_block)
- `rpc_requests_total{chain,method,outcome}` / `rpc_latency_ms_bucket`
- `db_ops_total{op,status}` / `db_latency_ms_bucket`
- `reorgs_pending_dropped_total{chain}`
- `bytes_ingested_total{chain}`
- `backfill_progress{chain}` (last_backfill_block / target)
- `queue_depth{chain}`

Per-chain `alertsConfig` values provide the expected cadence: `noEventsSeconds` feeds the "no events" alert window, while `maxLagBlocks` sets the allowable block lag before paging. Operators should calibrate these numbers to the on-chain feed update frequency and block times.

### 12.2 Alerts (accepted defaults)

- No events on a chain for longer than the configured `alertsConfig.noEventsSeconds`.
- Error rate > **2%** for **5 min**.
- Lag above `alertsConfig.maxLagBlocks`.
- Backfill progress stalled **10 min**.

### 12.3 Logging & tracing

- JSON logs (request‑scoped correlation).
- OpenTelemetry spans around RPC, decode, DB tx.
  (**Provide collector endpoint when ready**.)

---

# 13) Security

- No PII; no special compliance constraints.
- Access via **Tailscale**; DB security groups restricted to indexer + consumers.
- **DB roles**:

  - `indexer_writer`: INSERT/UPDATE/UPSERT permissions.
  - `sync_reader`: **read‑only** (for your syncing service).

---

# 14) Testing strategy

- **Unit**: decoding (`decodeADFSCalldata`), topic/version routing, address/bit conversions.
- **Integration**: chain harness with local Postgres; viem calls mocked and real (against devnet).
- **Reorg simulation**: fabricate pending -> dropped transitions and confirm finality flips.
- **Load**: synthetic bursts (feedsLength up to guardrail) to exercise queue/backpressure.
- **End‑to‑end**: backfill from known block range; verify `feed_latest` correctness.

---

# 15) Deployment & operations

- **Packaging**: Docker image.
- **Modes**:

  - `--mode=multi` (all chains in one process).
  - `--mode=per-chain --chainId=...` (one process per chain).

- **Kubernetes or Compose**: both supported; health/readiness endpoints:

  - `/healthz` (process + DB ping)
  - `/readyz` (initial backfill not required to be “ready”).

- **Postgres HA**: “OK” for managed HA; otherwise single instance acceptable initially; enforce online-safe migrations only.
- **Runbooks**:

  1. **RPC outage**: switch providers; increase backoff; drain queue.
  2. **DB saturation**: raise pool size cautiously; reduce batch; shard per chain.
  3. **Stuck backfill**: restart backfill fiber at last_backfill_block; shrink range.

---

# 16) Client‑facing schema notes (for consumers)

- **Latest read**:

```sql
SELECT data, block_number, block_timestamp, tx_hash, version
FROM   feed_latest
WHERE  chain_id = $1 AND feed_id = $2 AND stride = $3;
```

- **Historical range**:

```sql
SELECT block_number, block_timestamp, data, version
FROM   feed_updates
WHERE  chain_id = $1 AND feed_id = $2
  AND  block_number BETWEEN $3 AND $4
  AND  status = 'confirmed'
ORDER BY block_number, log_index;
```

- **Ring buffer random read**:

```sql
-- Compute table_index in app: (2 ** 115 * stride + feedId) / 16
SELECT block_number, block_timestamp, data
FROM   ring_buffer_writes
WHERE  chain_id = $1 AND table_index = $2
  AND  status = 'confirmed'
ORDER BY block_number DESC
LIMIT 1;
```

---

# 17) Defaults & tunables

- `db_write_batch_rows`: **200**
- `queue_max_items`: **10,000**
- `alertsConfig`: `noEventsSeconds=300`, `maxLagBlocks=64` (per chain; adjust to feed cadence)
- Backfill range step: start **2,000** blocks; shrink to **256** on error
- Confirmations per chain: from config
- Metrics endpoint: `:service.metricsPort/metrics` (default `:9464/metrics`)
- Logs: `info` level (configurable `LOG_LEVEL`)
- Tracing: enabled when `OTEL_EXPORTER_OTLP_ENDPOINT` is set

---

# 18) Implementation notes (TS/Effect)

- **Decoding**: `decodeADFSCalldata(calldata, hasBlockNumber)` returns:

  - If `hasBlockNumber=true`: includes `blockNumber` (ignored as we trust event data).
  - Else: includes `(sourceAccumulator, destinationAccumulator)`; persist into `extra`.

- **Address & bits**:

  - Convert 0x‑address -> `BYTEA` for DB; inverse for UI as needed.
  - `feedId` stored as `BIT(128)`; provide helpers to convert `bigint <-> bit(128)`.

- **Ordering buffer**:

  - Minimal in‑memory index keyed by `(blockNumber, logIndex)`.
  - Flush per block to DB transaction.

---

# 19) Out‑of‑scope (v1)

- Admin API/CLI: not planned.
- Web UI dashboard (Grafana only).
- Dead‑letter queue (disabled; rely on metrics + retries).

---

# 20) Deliverables

1. **Repository** with:

   - `/src` (Effect layers, workers, repos)
   - `/migrations` (SQL; online‑safe)
   - `/config/example.config.json`
   - `/helm` or `/compose` (optional)

2. **Grafana dashboards** JSON for metrics above.
3. **Runbooks** for three incident types.
4. **Tests** (unit, integration, reorg, load).
5. **Docs** (`README.md`) describing config, deploy modes, and schema.

---

## Appendix A — Proxy “Upgraded” ABI (for watcher)

```ts
export const UpgradedEventAbi = [
  {
    type: 'event',
    name: 'Upgraded',
    inputs: [{ name: 'implementation', type: 'address', indexed: true }],
    anonymous: false,
  },
] as const;
```

---

## Appendix B — Minimal repository API (TypeScript)

```ts
type Status = 'pending' | 'confirmed' | 'dropped';

interface InsertEvent {
  chainId: number;
  blockNumber: bigint;
  blockHash: `0x${string}`;
  blockTimestamp: Date;
  txHash: `0x${string}`;
  logIndex: number;
  topic0: `0x${string}`; // keccak256(topicName)
  status: Status;
  version: number;
  calldata: `0x${string}`;
  hasBlockNumber: boolean;
  extra: Record<string, unknown>;
}

interface FeedUpdateRow {
  chainId: number;
  blockNumber: bigint;
  blockHash: `0x${string}`;
  blockTimestamp: Date;
  txHash: `0x${string}`;
  logIndex: number;
  status: Status;
  version: number;
  stride: number;
  feedId: bigint; // convert to BIT(128) on insert
  rbIndex: number; // u16
  data: `0x${string}`;
  extra: Record<string, unknown>;
}

interface RingBufferWriteRow {
  chainId: number;
  blockNumber: bigint;
  blockHash: `0x${string}`;
  blockTimestamp: Date;
  txHash: `0x${string}`;
  logIndex: number;
  status: Status;
  version: number;
  tableIndex: bigint;
  data: `0x${string}`;
  extra: Record<string, unknown>;
}
```
