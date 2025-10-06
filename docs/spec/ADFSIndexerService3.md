# EVM Multichain Indexing Service — Software Specification

_Target stack: Node.js, TypeScript, Effect (v3+), viem, PostgreSQL. Revision: 2025-09-02._

---

## 0) Executive Summary

Index a single proxy-fronted ADFS contract per supported chain, ingest the **DataFeedsUpdated** event stream, fetch and decode transaction calldata, and persist both raw and normalized artifacts into PostgreSQL. The service supports historical backfill from each contract deployment block, live tail with configurable finality, and contract upgrades via proxy `Upgraded(address)` events. It exposes a latest-per `(chain_id, feed_id, stride)` materialization, retains pending history for reorg handling, and surfaces observability, runbooks, and admin tools required for operations. Downstream systems synchronize solely from the database using read-only credentials.

---

## 1) Scope

### 1.1 Goals

- Multichain ingestion with parallelism by chain and strict ordering within each chain.
- Historical backfill from contract deployment block, followed by live tail.
- Decode calldata using `decodeADFSCalldata(calldata, hasBlockNumber)` with version-driven semantics.
- Persist raw transaction input, decoded JSON, normalized feed updates, ring buffer writes, and a latest materialization.
- Maintain `pending → confirmed → dropped` state machine for reorg resilience and split confirmed/latest materializations.
- Provide admin surfaces for targeted backfill, health inspection, and partition management.
- Supply observability (metrics, logs, tracing) and documented runbooks for common incidents.

### 1.2 Non-Goals

- Hot-reloading configuration (restart to apply changes).
- Persistent external queues beyond in-memory bounded buffers.
- On-chain storage reads outside of logs, transaction, and receipt data.
- End-user UI; Grafana dashboards only.

---

## 2) Functional Requirements

### 2.1 Chains & Contracts

- Support a configurable set of chains; one ADFS proxy/contract per chain.
- Monitor the proxy address; derive implementation changes via `Upgraded(address)`.
- Backfill from each contract’s deployment `startBlock` including the block itself.
- Run live tail via WebSocket subscriptions, maintaining block-number and log-index ordering per chain.
- Finality mode is per-chain configurable (e.g., simple confirmations vs. dual-source L2 finality) and persisted in config.

### 2.2 Events & Decoding

- `topicNames` config maps contract `version` → event signature (e.g. `{ "1": "DataFeedsUpdated(uint256)" }`); the service derives `topic0 = keccak256(topicNames[version])` for the active version and subscribes to the union of all known topics per chain so upgrades don't miss logs.
- `versions` config maps version → decoder profile (`hasBlockNumber`, expected `extraFields[]`, optional guards).
- `implVersionMap` config maps proxy implementation address → version; unknown implementations pause ingestion for that chain and raise an alert.
- For each matched log: fetch transaction, receipt, and input data; decode with `decodeADFSCalldata(calldata, hasBlockNumber)` where `hasBlockNumber` is dictated by the active contract version.
- Decoder yields `feeds[]` (exposes `stride`, `feedId` as u128, `index` as u16 - `rb_index`, and `data` bytes) and `ringBufferTable[]` (global `table_index` as u128`, plus `data`).
- Version-specific extras (e.g., `sourceAccumulator`, `destinationAccumulator`) are persisted in a JSONB `extra` column.
- Event block metadata remains the source of truth for `blockNumber` and `blockTimestamp`.

### 2.3 Consumer Queries (Day 1)

- Fetch latest confirmed value for `(chain_id, feed_id, stride)`.
- Fetch confirmed updates for `(chain_id, feed_id)` within block range `[A, B]`.
- Fetch ring buffer slot by `(chain_id, feed_id, rb_index, stride)`.
- List active feeds per chain filtered by `block_timestamp >= now() - make_interval(days => X)`.

### 2.4 Guardrails & Limits

- `feedsLength` limit defaults to 10,000 (configurable); exceeding the limit pauses the chain, raises a P1 alert, records `adfs_indexer_guard_dropped_total{reason="feedsLength"}`, and schedules an automatic backfill starting `guardBackfillWindow` blocks before the last persisted block.
- Maximum calldata size defaults to 128 KiB (configurable per chain); oversized calldata follows the same pause + alert + backfill policy as above (reason=`calldataSize`).
- In-memory ordering queue per chain with hard capacity (default 10,000); on overflow the chain pauses ingestion, emits `adfs_indexer_queue_overflow_total`, and schedules a catch-up backfill using `overflowBackfillWindow`. Gaps wait up to `ordering.maxOutOfOrderWaitMs` before partial flush occurs.
- Decoder rejects malformed payloads or indices outside `[0, 8192)`.

---

## 3) Non-Functional Requirements

- Throughput target: approximately 1–2 matching transactions per block per chain.
- Strict ordering by `(block_number, log_index)` within a chain; cross-chain work executes concurrently.
- Idempotency via natural key `(chain_id, tx_hash, log_index)` enforced with UPSERT semantics.
- Environment separation: dedicated Postgres instances (or at minimum isolated databases/schema search_paths) for `devnet`, `testnet`, and `mainnet` to avoid cross-env accidents.
- Partitioning: LIST by `chain_id`, RANGE by `block_timestamp` (monthly subpartitions).
- Security: network access via Tailscale; secrets injected by environment variables.
- Availability: ingestion process targets ≥99.9% uptime excluding upstream outages.
- Durability: `confirmed` writes succeed ≥99.9% per day.

---

## 4) Architecture

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
|  - ConfigLayer (JSON -> typed config; no hot reload)                 |
|  - ViemLayer   (HTTP + WS clients, rate-limit aware)                |
|  - DbLayer     (Postgres/Drizzle pool + migrations)                  |
|  - MetricsLayer(Log/metrics spans → Prom exporter)                   |
|  - LogLayer    (structured JSON logs)                                |
|  - TracingLayer(Effect metrics counters → OTLP)                      |
|                                                                      |
|  Supervisors per chain:                                              |
|  - VersionManager (Upgraded watcher + decoder profile map)           |
|  - BackfillWorker (HTTP getLogs)                                     |
|  - LiveTailWorker (WS subscription, tx/receipt fetch)                |
|  - ProxyUpgradeWatcher (WS/HTTP)                                     |
|  - BlockHeaderCache (HTTP)                                           |
|  - OrderingBuffer (per-chain queue)                                  |
|  - Writer (per-block DB tx)                                          |
|                                                                      |
+----------------------------------------------------------------------+
          |
          v
+----------------------------+
|        PostgreSQL          |
|  (per env: dev/test/main)  |
+----------------------------+
```

### 4.1 Effect Layers

- **ConfigLayer** parses JSON, validates against schema, and exposes typed config.
- **ViemLayer** builds per-chain `publicClient` (HTTP) and `webSocketClient` handles with fallback selection across configured endpoint arrays and optional rate limits.
- **DbLayer** uses Drizzle + `pg` pool tuned per deployment; exposes repository methods implementing idempotent UPSERTs and partition helpers.
- **MetricsLayer** wraps Effect tracing spans (see <https://effect.website/docs/observability/tracing/>) to emit latency histograms and counters exposed over Prometheus.
- **LogLayer** provides structured JSON logging (pino-friendly) with correlation IDs.
- **TracingLayer** registers Effect metrics counters/histograms and exports them to OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is configured.

### 4.2 Fiber Layout & Responsibilities

- **BackfillWorker** walks historical ranges via `eth_getLogs`, adapts step size (start 10k blocks, shrink to 256 on repeated failures), fetches missing tx/block metadata, decodes payloads, and streams them into OrderingBuffer.
- **LiveTailWorker** streams WS events via `watchEvent`, falling back to HTTP polling against `rpcHttp` when WS is unavailable, and enriches each log with tx input + header data before enqueueing.
- **ProxyUpgradeWatcher** monitors `Upgraded(address)` events over WS/HTTP catch-up, persists `proxy_versions`, recomputes decoder profile, and backfills missed upgrades.
- **BlockHeaderCache** memoizes recent block headers per chain to avoid redundant RPC calls when multiple logs share the same block.
- **OrderingBuffer/Writer** merges backfill + live feeds in `(block_number, log_index)` order and flushes per-block batches inside a single transaction; on overflow it pauses the chain and triggers catch-up backfill.

---

## 5) Components & Responsibilities

### 5.1 VersionManager

- On startup: scans `Upgraded(address)` events from `startBlock` to head; resolves implementation → version using `implVersionMap`. Unknown implementations trigger a chain-specific pause + alert.
- Maintains in-memory map `chain_id → {version, decoderProfile, topic0, topicSet, expectedExtraFields, impl, expectedBytecodeHash?}` derived from config `versions`, `topicNames`, and `implVersionMap`; `topicSet` is the union of all known topic hashes used for filtering; `hasBlockNumber` is derived from decoder profile, not stored per event.
- Live subscription bumps version, recalculates `topic0` from config, stores `(chain_id, version, implementation, topic_hash, bytecode_hash)` in DB, and resumes only after config contains the mapping.
- Decoder profiles come directly from config:
  - Example: Version 1 → `{ hasBlockNumber: true, extraFields: [] }`.
  - Example: Version 2 → `{ hasBlockNumber: false, extraFields: ['sourceAccumulator','destinationAccumulator'] }`.

### 5.2 BackfillWorker

- Iterates `getLogs` batches from `startBlock` up to the chain's configured finality horizon (e.g., `head - confirmations` for L1 or L2-specific depth for dual-source), partitioning ranges by `proxy_versions` epochs so each chunk uses the matching `(topic0 set, decoderProfile)` and recording L1 inclusion metadata when dual-source mode is active.
- Uses adaptive range: initial 10,000 blocks; halves to minimum 256 on RPC failures.
- Writes pending rows; relies on Writer for batching.
- Resumable via per-chain cursors stored in DB.
- Optionally acquires advisory lock (`pg_try_advisory_lock(hashtext('backfill:' || chain_id))`) when running multiple indexer instances to ensure only one backfill worker operates per chain; non-lock holders skip backfill and rely on live tail. Emit lock-age metrics (`adfs_indexer_lock_age_seconds`) when holding the lock for monitoring.

### 5.3 LiveTailWorker

- WS subscription filtered by proxy address + the union of all known topic hashes (`topicSet`) supplied by VersionManager so upgrades do not miss logs.
- For each log: fetches transaction & receipt via HTTP client, decodes calldata via VersionManager, enqueues event.
- Reconnect strategy with exponential backoff; HTTP polling fallback when WS unreachable.

### 5.4 OrderingBuffer & Writer

- Buffer keyed by `(blockNumber, logIndex)`; per-chain single writer fiber.
- Maintains bounded capacity; on overflow it pauses the chain, emits `adfs_indexer_queue_overflow_total`/P1 alert, and triggers a catch-up backfill covering the recent unpersisted range. Gaps wait up to `ordering.maxOutOfOrderWaitMs`; beyond that the buffer flushes available items and logs a warning.
- Flushes one block at a time inside a DB transaction: insert pending events, updates, ring buffer writes, raw calldata.
- Applies UPSERT on natural keys and writes to latest table on confirmation.
- Deployments should run one writer per chain per process; if multiple processes contend, adopt the same advisory-lock strategy (`pg_try_advisory_lock(hashtext('writer:' || chain_id))`) to ensure a single leader drains the queue and emit `adfs_indexer_lock_age_seconds` for visibility.
- Writer only persists `pending` rows; FinalityProcessor alone flips states and updates `feed_latest`.

### 5.5 Finality Processor

- Periodically evaluates per-chain finality mode from config:
  - `l1_confirmations`: compute `last_safe_block = head - confirmations`.
  - `dual_source`: require both L2 head depth and L1 inclusion (timestamped) thresholds before advancing `last_safe_block`.
- Acquires a per-chain Postgres advisory lock (`pg_try_advisory_lock(hashtext('finality:' || chain_id))`); only the lock holder executes finality for that chain and records lock age for observability.
- Transitions pending rows at or below safe block to `confirmed` and updates latest table with upsert semantics.
- Marks pending rows as `dropped` when replaced by competing fork before confirmation.
- If lock acquisition fails, log at debug and retry on next cycle without performing state transitions.

### 5.6 ProxyUpgradeWatcher

- Watches proxy `Upgraded(address implementation)` topic over WS and scheduled HTTP catch-up.
- Uses `implVersionMap` to resolve version; if the implementation is unknown, raises alert and pauses ingestion for that chain until operators update config.
- When checksum guard enabled, fetches runtime bytecode once, compares keccak hash to expected value (if provided), and pauses ingestion on mismatch.
- Persists `(chain_id, version, implementation, topic_hash, activated_block, bytecode_hash)` to `proxy_versions`, where `topic_hash = keccak256(topicNames[version])` and `bytecode_hash` is optional keccak of runtime bytecode for guardrails.
- Notifies VersionManager to reload decoder profile, `topic0`, expected extra fields, and re-evaluate `hasBlockNumber` once configuration is redeployed (service restart required for updates).

### 5.7 BlockHeaderCache & Metadata Fetchers

- Maintains bounded LRU per chain containing `block_hash`, `timestamp`, and `transactions` metadata.
- Ensures Writer operates with consistent header data even during RPC retries.
- Provides helpers for ring-buffer stride math reused by consumer APIs.

---

## 6) Data Model & Storage

### 6.1 Tables

- `chains`: chain metadata (chain_id, name); finality modes and depths live in JSON config.
- `contracts`: proxy address, deployment `start_block`, and initial `topic_hash` (derived from the version-to-signature map) per chain.
- `proxy_versions`: `(chain_id, version, implementation, topic_hash, activated_block, bytecode_hash)`; append-only and sourced from config mapping at activation time, with optional runtime bytecode hash for auditing. Backfill uses these epochs to select the correct `(topicSet, decoderProfile)` per range.
- `adfs_events`: partitioned by chain/timestamp; raw event metadata, status enum, calldata, version, `topic0`.
- `tx_inputs`: optional normalized transaction input archive storing selector, decoded JSON, status, and version for auditing.
- `feed_updates`: normalized feed entries with `feed_id` stored as `BYTEA(16)`, `stride`, `rb_index`, payload bytes, status, version.
- `ring_buffer_updates`: table writes keyed by `table_index` stored as `BYTEA(16)` plus payload bytes, status, version.
- `feed_latest`: confirmed-only latest pointer per `(chain_id, feed_id, stride)` including pointer back to canonical event and `extra` metadata JSON.
- `processing_state`: per-chain cursors (`last_seen_block`, `last_safe_block`, `last_backfill_block`).
- Retention: keep full history partitions for 6 months; drop older `tx_inputs` and `adfs_events` partitions containing only `dropped` rows via scheduled maintenance.

### 6.2 Keys, Partitions & Types

- Natural unique index `(chain_id, tx_hash, log_index)` across `adfs_events`; downstream tables rely on application-enforced integrity (no cross-table FKs due to partitioning constraints).
- Secondary indices on `(chain_id, feed_id, stride)` for `feed_latest` and `feed_updates`.
- LIST partitions by `chain_id`; RANGE (monthly) subpartitions by `block_timestamp` for `adfs_events`, `feed_updates`, `ring_buffer_updates`, and `tx_inputs`.
- Monthly partitions support retention: drop partitions older than 6 months for `tx_inputs` and `adfs_events` (only `dropped` rows) using scheduled jobs.
- `feed_id`: `BYTEA` (16 bytes); `rb_index`: `INTEGER CHECK (value >= 0 AND value < 8192)`; `ring_buffer_table_index`: `BYTEA` (16 bytes).
- Enum `adfs_state` = `('pending','confirmed','dropped')` shared across partitioned tables.

### 6.3 Helper Functions

- Provide canonical conversion helpers **(big-endian byte layout)** so app/DB stay in sync:

  ```sql
  CREATE OR REPLACE FUNCTION hex_to_bytea16(hex TEXT)
  RETURNS BYTEA
  LANGUAGE SQL IMMUTABLE AS $$
    SELECT decode(lpad(regexp_replace(lower($1), '^0x', ''), 32, '0'), 'hex')
  $$;

  CREATE OR REPLACE FUNCTION bytea16_to_hex(val BYTEA)
  RETURNS TEXT
  LANGUAGE SQL IMMUTABLE AS $$
    SELECT '0x' || encode(val, 'hex')
  $$;
  ```

- Create views exposing `feed_updates`/`feed_latest` with hex-form `feed_id` and `table_index` for analytics use via `bytea16_to_hex`.
- Stored function `compute_table_index(feed_id BYTEA, stride SMALLINT)` returns `BYTEA(16)` and mirrors on-chain addressing (treating bytes as big-endian u128).
- Document endianness & timestamps: bytes are stored big-endian, matching the on-chain u128 encoding; block timestamps (EVM seconds) convert to `TIMESTAMPTZ` via `to_timestamp` (UTC semantics).

### 6.4 Materializations & Constraints

- `feed_latest` maintained via UPSERT selecting newest `(block_number, log_index, rb_index)`:

```sql
INSERT INTO feed_latest AS fl
(chain_id, feed_id, stride, block_number, block_timestamp, block_hash, tx_hash, log_index, rb_index, data, version, extra)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
ON CONFLICT (chain_id, feed_id, stride)
DO UPDATE SET
  block_number = EXCLUDED.block_number,
  block_timestamp = EXCLUDED.block_timestamp,
  block_hash   = EXCLUDED.block_hash,
  tx_hash      = EXCLUDED.tx_hash,
  log_index    = EXCLUDED.log_index,
  rb_index     = EXCLUDED.rb_index,
  data         = EXCLUDED.data,
  version      = EXCLUDED.version,
  extra        = EXCLUDED.extra
WHERE (fl.block_number, fl.log_index, fl.rb_index)
    < (EXCLUDED.block_number, EXCLUDED.log_index, EXCLUDED.rb_index);
```

- Indexes supporting day-1 queries:

  - `feed_latest_point_lookup_idx` on `(chain_id, feed_id, stride)`.
  - `feed_updates_range_q_idx` on `(chain_id, feed_id, stride, block_number, log_index)`.
  - `ring_buffer_updates_slot_latest_idx` on `(chain_id, table_index, block_number DESC, log_index DESC)`.

- Composite PKs:
  - `adfs_events (chain_id, tx_hash, log_index)`
  - `feed_updates (chain_id, tx_hash, log_index, feed_id, stride, rb_index)`
  - `ring_buffer_updates (chain_id, tx_hash, log_index, table_index)`
- Cascading deletes avoided; use soft deletes via status transitions.

### 6.5 Client-Facing Schema Notes

- Latest read:

```sql
SELECT data, block_number, block_timestamp, tx_hash, version
FROM   feed_latest
WHERE  chain_id = $1 AND feed_id = $2 AND stride = $3;
```

- Historical range:

```sql
SELECT block_number, block_timestamp, data, version
FROM   feed_updates
WHERE  chain_id = $1 AND feed_id = $2 AND stride = $3
  AND  block_number BETWEEN $4 AND $5
  AND  status = 'confirmed'
ORDER BY block_number, log_index;
```

- Ring buffer random read (table index computed client-side as `(2 ** 115 * stride + feedId) / 16`):

```sql
SELECT block_number, block_timestamp, data
FROM   ring_buffer_updates
WHERE  chain_id = $1 AND table_index = $2
  AND  status = 'confirmed'
ORDER BY block_number DESC
LIMIT 1;
```

### 6.6 Core Tables DDL (Excerpt)

```sql
CREATE TYPE adfs_state AS ENUM ('pending', 'confirmed', 'dropped');

CREATE TABLE chains (
  chain_id       INTEGER PRIMARY KEY,
  name           TEXT    NOT NULL
);

CREATE TABLE contracts (
  chain_id            INTEGER REFERENCES chains(chain_id),
  proxy_address       BYTEA  NOT NULL,
  initial_topic_hash  BYTEA  NOT NULL,
  start_block         BIGINT NOT NULL,
  UNIQUE (chain_id)
);

CREATE TABLE proxy_versions (
  chain_id        INTEGER NOT NULL REFERENCES chains(chain_id),
  version         INTEGER NOT NULL,
  implementation  BYTEA   NOT NULL CHECK (octet_length(implementation) = 20),
  topic_hash      BYTEA   NOT NULL CHECK (octet_length(topic_hash) = 32),
  bytecode_hash   BYTEA   NULL CHECK (octet_length(bytecode_hash) = 32),
  activated_block BIGINT  NOT NULL,
  PRIMARY KEY (chain_id, version)
);

CREATE TABLE adfs_events (
  chain_id        INTEGER NOT NULL,
  block_number    BIGINT  NOT NULL,
  block_hash      BYTEA   NOT NULL CHECK (octet_length(block_hash) = 32),
  block_timestamp TIMESTAMPTZ NOT NULL,
  tx_hash         BYTEA   NOT NULL CHECK (octet_length(tx_hash) = 32),
  log_index       INTEGER NOT NULL,
  topic0          BYTEA   NOT NULL CHECK (octet_length(topic0) = 32),
  status          adfs_state NOT NULL,
  version         INTEGER NOT NULL,
  calldata        BYTEA   NOT NULL,
  extra           JSONB   NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (chain_id, tx_hash, log_index)
) PARTITION BY LIST (chain_id);

CREATE INDEX adfs_events_block_idx
  ON adfs_events (chain_id, block_number, log_index);

CREATE INDEX adfs_events_topic_idx
  ON adfs_events (chain_id, topic0, block_number);

CREATE TABLE tx_inputs (
  chain_id        INTEGER NOT NULL,
  tx_hash         BYTEA   NOT NULL CHECK (octet_length(tx_hash) = 32),
  status          adfs_state NOT NULL,
  version         INTEGER NOT NULL,
  selector        BYTEA   NOT NULL,
  decoded         JSONB   NOT NULL,
  PRIMARY KEY (chain_id, tx_hash)
) PARTITION BY LIST (chain_id);

CREATE TABLE feed_updates (
  chain_id        INTEGER NOT NULL,
  block_number    BIGINT  NOT NULL,
  block_hash      BYTEA   NOT NULL CHECK (octet_length(block_hash) = 32),
  block_timestamp TIMESTAMPTZ NOT NULL,
  tx_hash         BYTEA   NOT NULL CHECK (octet_length(tx_hash) = 32),
  log_index       INTEGER NOT NULL,
  status          adfs_state NOT NULL,
  version         INTEGER NOT NULL,
  stride          SMALLINT NOT NULL,
  feed_id         BYTEA    NOT NULL CHECK (octet_length(feed_id) = 16),
  rb_index        SMALLINT NOT NULL CHECK (rb_index >= 0 AND rb_index < 8192),
  data            BYTEA    NOT NULL,
  extra           JSONB    NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (chain_id, tx_hash, log_index, feed_id, stride, rb_index)
) PARTITION BY LIST (chain_id);

CREATE INDEX feed_updates_range_q_idx
  ON feed_updates (chain_id, feed_id, stride, block_number, log_index);

CREATE TABLE ring_buffer_updates (
  chain_id        INTEGER NOT NULL,
  block_number    BIGINT  NOT NULL,
  block_hash      BYTEA   NOT NULL CHECK (octet_length(block_hash) = 32),
  block_timestamp TIMESTAMPTZ NOT NULL,
  tx_hash         BYTEA   NOT NULL CHECK (octet_length(tx_hash) = 32),
  log_index       INTEGER NOT NULL,
  status          adfs_state NOT NULL,
  version         INTEGER NOT NULL,
  table_index     BYTEA    NOT NULL CHECK (octet_length(table_index) = 16),
  data            BYTEA   NOT NULL,
  extra           JSONB   NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (chain_id, tx_hash, log_index, table_index)
) PARTITION BY LIST (chain_id);

CREATE INDEX ring_buffer_updates_slot_latest_idx
  ON ring_buffer_updates (chain_id, table_index, block_number DESC, log_index DESC);

CREATE TABLE feed_latest (
  chain_id        INTEGER NOT NULL,
  feed_id         BYTEA    NOT NULL CHECK (octet_length(feed_id) = 16),
  stride          SMALLINT NOT NULL,
  block_number    BIGINT   NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  block_hash      BYTEA    NOT NULL CHECK (octet_length(block_hash) = 32),
  tx_hash         BYTEA    NOT NULL CHECK (octet_length(tx_hash) = 32),
  log_index       INTEGER  NOT NULL,
  rb_index        SMALLINT NOT NULL,
  data            BYTEA    NOT NULL,
  version         INTEGER  NOT NULL,
  extra           JSONB    NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (chain_id, feed_id, stride)
);

CREATE INDEX feed_latest_point_lookup_idx
  ON feed_latest (chain_id, feed_id, stride);

CREATE TABLE processing_state (
  chain_id             INTEGER PRIMARY KEY,
  last_seen_block      BIGINT NOT NULL DEFAULT 0,
  last_safe_block      BIGINT NOT NULL DEFAULT 0,
  last_backfill_block  BIGINT NOT NULL DEFAULT 0
);
```

---

## 7) Processing Lifecycle

1. Startup loads config, establishes DB/RPC clients, runs migrations, initializes metrics/logging.
2. VersionManager backfills upgrade events and seeds `version` map.
3. BackfillWorker and LiveTailWorker emit decoded payloads into OrderingBuffer.
4. OrderingBuffer ensures ordered batches; on overflow, it pauses the chain and enqueues a catch-up backfill starting `overflowBackfillWindow` blocks before the last persisted block.
5. Writer persists pending rows in per-block transactions.
6. Finality processor acquires advisory lock per chain; if held, promotes rows to `confirmed`, updates `feed_latest`, and soft deletes (`dropped`) orphaned pending rows.
7. Downstream consumers read confirmed and latest tables with read-only credentials.

### 7.1 Event Processing Flow

1. Detect matching log (`topic0`, proxy address).
2. Resolve active version at `block_number` from `proxy_versions`; verify the recorded implementation exists in `implVersionMap`, check optional `expectedBytecodeHash` when provided, and fetch the corresponding signature `topic0` from config (fallback to DB hash if config lacks entry).
3. Fetch transaction calldata and receipt (`eth_getTransactionByHash`).
4. Decode calldata via `decodeADFSCalldata(calldata, versionsConfig[version].hasBlockNumber)`; validate that `extra` payload matches `versionsConfig[version].extraFields` when present.
5. Assemble rows for `adfs_events`, `tx_inputs`, `feed_updates`, `ring_buffer_updates` (topic selection splits backfill ranges at `proxy_versions` boundaries to use the right hash set).
6. Upsert pending rows within a single DB transaction per block.
7. Separate finality loop computes `last_finalized_block` according to the configured finality mode (simple confirmations vs. dual-source) and flips eligible rows to `confirmed`, upserting `feed_latest`. Pending rows orphaned by reorgs flip to `dropped` (no replay).

---

## 8) Reorg & Finality Handling

- State machine: `pending` → `confirmed` (safe block reached) or `pending` → `dropped` (reorg before confirmation).
- Confirmed rows remain immutable; dropped rows flagged via soft delete (`status = 'dropped'`).
- Backfill replays ranges to reconcile after large reorgs or missed periods.
- `reorgs_pending_dropped_total` counter surfaces reorg churn for alerting.
- Dual-source finality ensures L2 chains wait for both sequencer depth and L1 inclusion before marking rows confirmed.

---

## 9) Configuration & Tunables

**Format**: configuration lives in JSON files with **no hot reload**; restart the service to apply changes.
**Secrets** enter via **environment variables** (DB URL, RPC credentials), and each environment (`devnet`, `testnet`, `mainnet`) owns a separate Postgres database plus JSON config.

- `finality`: per-chain config describing mode and thresholds.
- `finality.mode`: `"l1_confirmations"` (default) uses simple confirmation depth; `"dual_source"` requires both L2 head depth and L1 inclusion windows.
- `finality.confirmations`/`l1Confirmations`: integer depth used for L1 safety.
- `finality.l2Depth` & `finality.maxL1DelaySeconds`: parameters for dual-source/L2 chains.
- `db.write.batchRows`: default 200 rows per insert batch.
- `queue.maxItems`: default 10,000 pending items per chain; on overflow pause the chain and initiate backfill.
- `overflowBackfillWindow`: blocks to rewind when queue overflow occurs (default 2,000).
- `guardBackfillWindow`: blocks to rewind when guards drop a payload (default 2,000).
- `alertsConfig`: `noEventsSeconds` default 300, `maxLagBlocks` default 64 per chain.
- Optional knobs: RPC rate limits, queue sizing, backfill range bounds, finality windows, and `ordering.maxOutOfOrderWaitMs` (default 1000 ms).
- `versions`: mapping from version → decoder profile (hasBlockNumber, expected extra fields, optional guards).
- `implVersionMap`: mapping from implementation address → `{ version, expectedBytecodeHash? }`; every deployed implementation must be listed and may optionally include a runtime bytecode checksum.
- `topicNames`: mapping from version → event signature; every active version must have a configured signature.
- `metrics.port`: default `9464` (`/metrics`).
- `LOG_LEVEL`: default `info`; structured JSON logs.
- `OTEL_EXPORTER_OTLP_ENDPOINT`: enables tracing when set.

### 9.1 Example Config JSON

```json
{
  "service": {
    "queueMaxItems": 10000,
    "dbWriteBatchRows": 200,
    "metricsPort": 9464,
    "overflowBackfillWindow": 2000,
    "guardBackfillWindow": 2000,
    "ordering": { "maxOutOfOrderWaitMs": 1000 }
  },
  "versions": {
    "1": { "hasBlockNumber": true, "extraFields": [] },
    "2": {
      "hasBlockNumber": false,
      "extraFields": ["sourceAccumulator", "destinationAccumulator"]
    }
  },
  "implVersionMap": {
    "0xabc...implA": { "version": 1, "expectedBytecodeHash": "0xhash1" },
    "0xdef...implB": { "version": 2 }
  },
  "chains": [
    {
      "chainId": 1,
      "name": "ethereum",
      "rpcHttp": ["https://primary.http", "https://backup.http"],
      "rpcWs": ["wss://primary.ws"],
      "finality": {
        "mode": "dual_source",
        "l2Depth": 30,
        "l1Confirmations": 12,
        "maxL1DelaySeconds": 180
      },
      "contractAddress": "0xProxyAddress",
      "topicNames": {
        "1": "DataFeedsUpdated(uint256)",
        "2": "DataFeedsUpdated(uint256,address)"
      },
      "startBlock": 19000000,
      "alertsConfig": { "noEventsSeconds": 300, "maxLagBlocks": 64 },
      "backfill": { "initialRange": 10000, "minRange": 256, "maxRange": 20000 }
    }
  ]
}
```

> `hasBlockNumber` is derived from `version`. Provide HTTP/WS endpoints in priority order; service iterates until a healthy provider responds. When WS endpoints fail, the tailer temporarily polls via HTTP to avoid data loss.
> `versions` and `implVersionMap` define decoder behavior and implementation authorization. Unknown implementations must be added before ingestion resumes.
> `topicNames` stay in config only; the database stores the computed hash (`topic0`) as `BYTEA` on relevant tables when events are ingested.
> Embed provider API keys directly inside RPC URLs; no extra indirection required.
> Prometheus metrics surface at `http://0.0.0.0:${service.metricsPort}/metrics` (default `9464`).
> Per-chain `alertsConfig` thresholds tune "no events" and "lag" alerts to the expected cadence.

### 9.2 Environment Variables

- `PG_URL` (writer connection string).
- `PG_READONLY_URL` (optional read replica for consumers).
- `OTEL_EXPORTER_OTLP_ENDPOINT` (enables tracing when set).
- `LOG_LEVEL` (default `info`).
- Provider API keys can be embedded in RPC URLs.

## 10) Observability & Alerting

### 10.1 Metrics (Prometheus)

- `adfs_indexer_events_processed_total{chain,status}` (pending/confirmed/dropped).
- `adfs_indexer_events_lag_blocks{chain}` and `adfs_indexer_finality_lag_blocks{chain}`.
- `adfs_indexer_rpc_requests_total{chain,method,outcome}` and `adfs_indexer_rpc_latency_ms_bucket{chain,method}`; `outcome` ∈ {success,error}.
- `adfs_indexer_db_ops_total{chain,op,outcome}` with `adfs_indexer_db_latency_ms_bucket{chain,op}`.
- `adfs_indexer_bytes_ingested_total{chain}`.
- `adfs_indexer_backfill_progress{chain}` (ratio of `last_backfill_block` to head).
- `adfs_indexer_queue_depth{chain}`.
- `adfs_indexer_out_of_order_wait_seconds{chain}` histogram tracking gap wait durations in the ordering buffer.
- `adfs_indexer_reorgs_total{chain,status}` (status ∈ {dropped}).
- `adfs_indexer_version_paused{chain}` (1 when ingestion paused due to unknown implementation or failed checksum).
- `adfs_indexer_queue_overflow_total{chain}` and `adfs_indexer_queue_overflow_backfill_height{chain}` to track pauses triggered by buffer saturation and the block height of the auto-backfill.
- `adfs_indexer_finality_lock_contention_total{chain}` counting failed advisory lock attempts.
- `adfs_indexer_lock_age_seconds{chain,lock}` tracking how long backfill/finality writer locks have been held.
- `adfs_indexer_guard_dropped_total{chain,reason}` for payloads rejected by guardrails (feedsLength, calldataSize, etc.).

Per-chain `alertsConfig` values supply the expected update cadence: `noEventsSeconds` feeds the "no events" alert window, while `maxLagBlocks` caps acceptable lag before paging.

### 10.2 Alerts

- No events on a chain for longer than `alertsConfig.noEventsSeconds`.
- `adfs_indexer_events_lag_blocks{chain}` or `adfs_indexer_finality_lag_blocks{chain}` above `alertsConfig.maxLagBlocks`.
- `adfs_indexer_rpc_errors_total{chain}` / `adfs_indexer_rpc_requests_total{chain}` > 2% for 5 minutes.
- `adfs_indexer_backfill_progress{chain}` flat for >10 minutes.
- `adfs_indexer_version_paused{chain}` = 1 for > 1 minute (unknown implementation or checksum mismatch).
- `adfs_indexer_queue_overflow_total{chain}` increments → trigger immediate page; verify auto backfill kicked off.
- `adfs_indexer_queue_depth{chain}` exceeding 80% of `queueMaxItems` for >5 minutes.
- `adfs_indexer_out_of_order_wait_seconds{chain}` p95 above `ordering.maxOutOfOrderWaitMs` for 5 minutes (investigate missing logs or RPC gaps).
- Sustained `adfs_indexer_finality_lock_contention_total{chain}` > 0 for 5 minutes (investigate competing instances).
- `adfs_indexer_guard_dropped_total{chain,reason}` increments → P1 page; ensure guardBackfillWindow backfill completed and root cause mitigated.
- `adfs_indexer_lock_age_seconds{chain,lock}` exceeding 300 seconds (stale advisory lock) → investigate stuck process and release if necessary.

### 10.3 Logging & Tracing

- Structured JSON logs with correlation IDs `(chain_id, tx_hash)`; guard against PII.
- OpenTelemetry spans wrap RPC calls, decoding, DB writes; exported when collector endpoint provided.
- MetricsLayer builds histograms from spans to feed Prometheus and Grafana dashboards.

### 10.4 Dashboards

- Grafana panels: ingest throughput, queue depth, RPC error budget, DB latency, confirmation lag, per-chain backfill progress.
- Annotated runbook links embedded in panels for fast incident response.

---

## 11) Admin Surfaces & Tools

- CLI / admin HTTP endpoints:
  - `backfill --chain <id> --from <block> --to <block>` for ad-hoc replays.
  - `state --chain <id>` showing cursors, lag, active version.
  - `partitions create --month <YYYY-MM>` to pre-create monthly partitions.
  - `locks release --chain <id> --type <backfill|finality|writer>` executes `SELECT pg_advisory_unlock(...)` with safeguards/logging.
- Commands emit structured JSON output suitable for automation.
- Read-only DB role for downstream consumers; separate write role for indexer.
- Runbooks stored with repo referencing Section 12 metrics.

---

## 12) Runbooks (Excerpt)

1. **RPC Outage**

   - Symptoms: rising `adfs_indexer_rpc_errors_total{chain}`, queue growth, backfill stalls.
   - Actions: switch provider URL, reduce backfill range, restart worker; ensure WS reconnects.

2. **DB Saturation**

   - Symptoms: elevated `adfs_indexer_db_latency_ms_bucket{chain}` (p99), queue depth increases.
   - Actions: tune `db.write.batchRows`, scale DB resources, consider per-chain deployment, add missing indices.

3. **Stuck Backfill**

   - Symptoms: `adfs_indexer_backfill_progress{chain}` flat for >10 minutes.
   - Actions: inspect RPC rate limits, narrow block ranges, restart targeted backfill.

4. **Unknown Implementation / Version Pause**

   - Symptoms: `adfs_indexer_version_paused{chain}` remains 1, alerts firing, ingestion halted for that chain.
   - Actions: inspect `proxy_versions` to identify new implementation; update `implVersionMap`, `versions`, and `topicNames` in config (including optional `bytecodeHash`), redeploy/restart service (no hot-reload) to resume ingestion; verify `adfs_indexer_version_paused{chain}` returns to 0.

5. **Queue Overflow Pause**

   - Symptoms: `adfs_indexer_queue_overflow_total{chain}` increments, ingestion auto-paused for that chain, catch-up backfill scheduled from `overflowBackfillWindow`.
   - Actions: confirm RPC health and consumer load, adjust `queue.maxItems` or throughput if necessary, monitor backfill completion, then resume ingestion once backlog clears.

6. **Guardrail Drop (feeds/calldata)**

   - Symptoms: `adfs_indexer_guard_dropped_total{chain,reason}` increments, chain auto-paused, backfill scheduled from `guardBackfillWindow`.
   - Actions: inspect offending transactions, adjust guard thresholds if appropriate, confirm auto backfill completion before resuming ingestion; treat as P1.

7. **Stale Advisory Lock**

   - Symptoms: `adfs_indexer_lock_age_seconds{chain,lock}` exceeds threshold, and `pg_stat_activity` shows idle holder.
   - Actions: investigate stuck worker, restart if necessary, and use `locks release --chain` admin command (invokes `pg_advisory_unlock`) to free the lock when safe.

---

## 13) Delivery Plan & Testing

- **M1 – Skeleton & Config (Week 1)**: Effect scaffolding, config loader, Drizzle migrations (base + partitions), viem clients, Prometheus/JSON logs.
- **M2 – Versioning & Live Tail (Week 2)**: VersionManager, decoder profiles, WS tail, per-block writer (pending states).
- **M3 – Backfill & Finality (Week 3)**: Range scanner, OrderingBuffer, pending→confirmed flips, reorg handling, `feed_latest` maintenance.
- **M4 – Normalization & Limits (Week 4)**: `feed_updates`, `ring_buffer_updates`, guardrails, anomaly telemetry.
- **M5 – Hardening & Tests (Week 5)**: unit/integration/reorg/load tests; runbooks; Grafana dashboards.
- **M6 – Launch (Week 6)**: Devnet → testnet → mainnet rollout; SLO baselining; on-call activation.

**Testing strategy:**

- Unit: decoder profiles, topic/version routing, address/bit conversions, ordering buffer invariants.
- Integration: viem clients against HTTP/WS endpoints, Postgres writes, migrations requiring partitions.
- Reorg simulation: forked chain verifying `pending → dropped` and confirmed stability beyond finality depth.
- Load: synthetic bursts up to guardrail limits (feedsLength 10k, calldata 128 KiB) to exercise queue/backpressure and validate overflow pause/backfill flow.
- End-to-end: backfill known block range and validate `feed_latest` pointers and consumer queries.

---

## 14) SLOs & Monitoring Targets

- Freshness: p50 ≤ 5s, p95 ≤ 30s from block inclusion to `pending`; `confirmed` within finality window.
- Durability: ≥ 99.9% successful confirmed writes per day.
- Availability: ingestion loop ≥ 99.9% excluding provider outages.

---

## 15) Defaults & Assumptions

- Proxy follows ERC-1967 upgrade event signature; alternate topics can be configured if needed.
- `DataFeedsUpdated` signature remains stable; service supports multiple signatures if configured.
- `stride` is non-negative; ring buffer indices stay within `[0, 8192)`.
- `db.write.batchRows` default 200; `queue.maxItems` default 10,000.
- Metrics endpoint exposed at `http://0.0.0.0:${metricsPort}/metrics` (defaults to `:9464/metrics`).
- Logs default to `info`; tracing enabled when `OTEL_EXPORTER_OTLP_ENDPOINT` is provided.
- Consumers rely on read-only DB credentials and must not modify ingestion tables.

---

## 16) Out-of-Scope (v1)

- Full-featured admin UI; Grafana dashboards suffice.
- Dead-letter queues; rely on retries plus metrics/alerts.
- External message buses; DB is the single sync surface.
- On-demand historical recomputation outside defined backfill tooling.

---

## 17) Deliverables

1. Repository workspace `apps/adfs-indexer` containing:
   - `/src` (Effect layers, workers, repositories).
   - `/tests` (unit, integration, load, reorg suites).
   - `/migrations` (Postgres, online-safe, partition helpers).
   - `/config/example.config.json` (annotated reference config).
2. Grafana dashboards JSON covering ingestion, lag, and resource metrics.
3. Documentation (`README.md`) with config instructions, deployment guidance, schema diagrams, and runbook links.

---

## 18) Open Implementation Tasks

- Optional materialized views for recent updates to support dashboards.
- Toggle for HTTP polling fallback thresholds and alerting when WS unavailable beyond SLA.
- Post-launch enhancement: consider admin tooling to update `implVersionMap` entries without restart (current flow requires redeploy).

---

## 19) Security & Access

- No PII stored; data limited to on-chain events and decoded payloads.
- Network restricted via Tailscale; only indexer hosts and read-only consumers can reach Postgres.
- DB roles:
  - `indexer_writer`: INSERT/UPDATE/UPSERT on ingestion tables.
  - `sync_reader`: read-only access for downstream services.
- Secrets managed through environment variables injected by deployment platform; avoid storing credentials in config JSON.
- Regularly rotate RPC keys and database passwords; document cadence in ops runbook.

---

## 20) Backpressure, Limits & Failure Policy

- Per-chain bounded queue has hard capacity; on overflow, pause ingestion for that chain, emit `adfs_indexer_queue_overflow_total`, and enqueue mandatory backfill before resuming.
- Queue depth exported via metrics; alert when >80% capacity for >5 minutes.
- `feedsLength` guard defaults to 10,000 entries; payloads exceeding limit trigger warn-level log, increment `adfs_indexer_guard_dropped_total`, pause the chain, and auto backfill from `guardBackfillWindow` before resuming.
- `rb_index` guard enforces values in `[0, 8192)` and rejects out-of-range indices (same pause/alert/backfill policy).
- Calldata limit 128 KiB prevents oversized RPC payloads from stalling decoding; configurable per chain.
- RPC retries use exponential backoff with jitter and rotate across configured endpoints.
- Persistent RPC failure escalates via runbook instructions (Section 12).

---

## 21) Deployment & Operations

- Supports containerized deployments (Docker/Kubernetes) and bare-metal supervisors; the same service binary can ingest multiple chains as defined in config, or multiple instances can be run with filtered configs for isolation.
- Recommended pattern: one deployment per environment (devnet/testnet/mainnet) pointing to dedicated Postgres instances.
- Partition creation can be automated via scheduled job invoking `partitions create --month <YYYY-MM>` for current + next 3 months.
- Schedule monthly jobs to detach/drop partitions older than retention (e.g., 6 months) for `tx_inputs` and `adfs_events` (dropped-only), followed by `VACUUM ANALYZE` on parent tables.
- Rolling upgrades: drain queue by pausing LiveTailWorker, allow Writer to flush, then restart with new version; resume tailing.
- Service startup validates `schema_version` in the database (e.g., `SELECT version FROM metadata.schema_version`) and aborts if it doesn't match the expected migration level.
- Include health endpoints exposing liveness/readiness with JSON payload:
  ```json
  {
    "chain": 1,
    "version": 2,
    "topicsWatching": ["0xabc…", "0xdef…"],
    "rpc": { "http": "healthy", "ws": "connecting" },
    "queueDepth": 123,
    "paused": false,
    "pausedReason": null,
    "lastSeenBlock": 19_345_678,
    "lastSafeBlock": 19_345_600,
    "lastBackfillBlock": 19_340_000
  }
  ```
  Expose both aggregated status and per-chain entries so operators can monitor RPC/WS connectivity, topic subscriptions, active version, and ingestion progress.

---

## 22) APIs for Consumers (DB-Centric)

- **Latest value**:

```sql
SELECT data, block_number, block_timestamp, version, extra
FROM feed_latest
WHERE chain_id = $1 AND feed_id = $2 AND stride = $3;
```

- **Updates in block range**:

```sql
SELECT *
FROM feed_updates
WHERE chain_id = $1
  AND feed_id  = $2
  AND stride   = $3
  AND status   = 'confirmed'
  AND block_number BETWEEN $4 AND $5
ORDER BY block_number, log_index;
```

- **Ring buffer slot history**:

```sql
SELECT *
FROM ring_buffer_updates
WHERE chain_id   = $1
  AND table_index = $2
  AND status      = 'confirmed'
ORDER BY block_number, log_index;
```

- **Active feeds since X days**:

```sql
SELECT chain_id, feed_id, stride, block_timestamp
FROM feed_latest
WHERE chain_id = $1
  AND block_timestamp >= now() - make_interval(days => $2::int);
```

---

## 23) Idempotency, Ordering & Transactions

- Unique natural key `(chain_id, tx_hash, log_index)` ensures deduplication across backfill/live overlap.
- OrderingBuffer enforces strict `(block_number, log_index)` ordering; gaps wait up to `ordering.maxOutOfOrderWaitMs` before logging and partially flushing available logs.
- On queue overflow, emit critical alert, pause the chain, and enqueue a mandatory catch-up backfill covering the window since the last persisted block.
- Finality processing uses advisory locks (`pg_try_advisory_lock`) to ensure only one instance per chain flips states.
- Writer executes one transaction per block per chain, batching inserts into `adfs_events`, `tx_inputs`, `feed_updates`, and `ring_buffer_updates`; state transitions and `feed_latest` UPSERTs happen in the Finality processor.
- FinalityManager maintains `last_safe_block` computed from latest head; confirmed rows never revert.
- Processing cursors (`processing_state`) allow resumable restarts without replaying confirmed data.

---

## 24) Implementation Notes (TS/Effect)

- `decodeADFSCalldata(calldata, hasBlockNumber)` returns version-specific extras; persist accumulator fields when `hasBlockNumber=false` and validate `extraFields` align with `versions[version].extraFields`.
- Maintain `versions: Record<number, VersionProfile>`, `implVersionMap: Record<string, ImplVersionConfig>`, and `topicNames: Record<number, string>` after config parsing; fail fast if any required mapping is missing before subscribing or writing rows. Precompute `proxy_versions` epochs to drive backfill chunking with matching topic/decoder profiles.
- Convert 0x addresses to `BYTEA` before inserting; provide helpers for hex ↔ `BYTEA(16)` conversions, and convert u128 `tableIndex` values into `BYTEA(16)` before persistence.
- When checksum enforcement is enabled, fetch runtime bytecode once per implementation (`eth_getCode`) and store `code_hash` (keccak) in `proxy_versions`.
- Ordering buffer implemented as minimal in-memory index keyed by `(blockNumber, logIndex)`; flush per block, use configured `overflowBackfillWindow` when pausing + backfilling after overflow, and rely on advisory locks to coordinate finality across instances.
- Finality evaluator reads `finality.mode` per chain; implement strategy interfaces so future modes (e.g., optimistic rollup finality) can be added without touching core pipeline.
- Validate `schema_version` in the database at startup and abort if migrations are missing.
- Foreign keys between partitioned tables are omitted; enforce integrity via unique keys and application logic when inserting into `feed_updates`, `ring_buffer_updates`, and `feed_latest`.
- Expose Effect services (`ConfigService`, `DbService`, `RpcService`, etc.) via dependency injection for unit tests.
- Prefer viem batch RPC for block + transaction fetching to minimize HTTP round-trips.
- Drizzle migrations manage enum/type creation and partition DDL; ensure forward-compatible schema evolution (online-safe `ALTER TABLE ... ATTACH PARTITION`).

---

## Appendix A — Proxy `Upgraded` Event ABI

```ts
export const UpgradedEventAbi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'implementation',
        type: 'address',
      },
    ],
    name: 'Upgraded',
    type: 'event',
  },
] as const;
```

---

## Appendix B — Minimal Repository Interfaces

```ts
type Status = 'pending' | 'confirmed' | 'dropped';

interface InsertEvent {
  chainId: number;
  blockNumber: bigint;
  blockHash: `0x${string}`;
  blockTimestamp: Date;
  txHash: `0x${string}`;
  logIndex: number;
  topic0: `0x${string}`;
  status: Status;
  version: number;
  calldata: `0x${string}`;
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
  feedId: bigint; // convert to BYTEA(16) on insert
  rbIndex: number; // 0..8191
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
  tableIndex: bigint; // convert to BYTEA(16) on insert
  data: `0x${string}`;
  extra: Record<string, unknown>;
}
```

---

## Appendix C — Partition DDL Example

```sql
-- LIST partition for chain 1
CREATE TABLE adfs_events_c1 PARTITION OF adfs_events
  FOR VALUES IN (1)
  PARTITION BY RANGE (block_timestamp);

-- Subpartition for September 2025
CREATE TABLE adfs_events_c1_2025_09 PARTITION OF adfs_events_c1
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
```
