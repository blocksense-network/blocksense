# EVM Multichain Indexing Service — Software Specification

_Target stack: Node.js + TypeScript + Effect (v3+), viem, Postgres. Revision: 2025‑09‑02._

## 0) Executive Summary

Build a multichain indexer that listens to a single proxy‑fronted ADFS contract per chain, decodes the transaction calldata whenever the **DataFeedsUpdated** event fires, and persists normalized + raw records into Postgres. The system supports **historical backfill** from each contract’s deployment block and **live tail** with per‑chain finality. It handles **contract upgrades** via the proxy’s **Upgraded(address)** event by bumping a **`version`** that controls decoding semantics and persists versioned **`extra`** JSON for forward compatibility. Another internal service can “sync up” solely from the database.

---

## 1) Goals & Non‑Goals

### Goals

- Multichain event ingestion (parallel by chain, ordered within chain).
- Backfill from contract **deployment block**; live tail thereafter.
- Decode input with `decodeADFSCalldata(calldata, hasBlockNumber)` using **version‑driven** `hasBlockNumber`.
- Persist:

  - **Raw** tx input (BYTEA) and **decoded JSON**.
  - **Normalized** feed updates and ring‑buffer table updates.
  - **Latest** confirmed value per `(chain_id, feed_id, stride)`, with optional "active since X days" filter.

- Reorg policy with per‑chain **pending → confirmed** or **pending → dropped** state.
- Separate Postgres DBs for **devnet**, **testnet**, **mainnet**.
- Observability via **Prometheus/Grafana**; JSON logs; optional OpenTelemetry.
- Admin surfaces for backfills and health, and runbooks for common incidents.

### Non‑Goals

- No hot‑reload of config; restarts apply changes.
- No persistent external queue (in‑memory bounded queues only).
- No on‑chain storage reads beyond logs/tx/receipt (tx input is sufficient).

---

## 2) Key Requirements

- **Sync target**: DB is the source for downstream services.
- **Backfill**: Yes, from deployment block.
- **Finality**: Per‑chain confirmations from config; state: `pending | confirmed | dropped`.
- **Contracts**: One proxy‑fronted ADFS per chain; **monitor the proxy** address.
  -- **Event meta**: `topicName` in config (e.g., "DataFeedsUpdated(uint256)"); the service derives `topic0` via `keccak256(topicName)`.
- **Versioning**:

  - Detect proxy **Upgraded(address)** events; increment **`version`** per chain.
  - **`hasBlockNumber`** is **derived from version**, not config.
  - DB rows carry `version`; version‑specific payloads go in `extra JSONB`.

- **Decoder**: always yields `feedId` (u128) and ring buffer `index` (u16).
- **Latest view key**: `(chain_id, feed_id, stride)`; expose recency via `block_timestamp` for "active since X days" filtering.
- **Types**:

  - `feed_id`: **BIT(128)**.
  - ring buffer index (u16): stored as **INTEGER** with `CHECK (between 0 and 65535)`.

- **Binary payload**: store as **BYTEA**.
- **Partitioning**: by **chain_id** and **monthly** time subpartitions.
- **Uniqueness**: `(chain_id, tx_hash, log_index)`; use **UPSERT** (idempotent).
- **Consumers**:

  - Queries: latest value; updates in block range; ring buffer head; active feeds since X days.
  - Per‑chain consistency is sufficient.
  - Include `block_timestamp` on rows (fetch headers).

- **Concurrency**:

  - Parallel **by chain**; **strict block/log order** within each chain.
  - One **DB transaction per block per chain**.
  - Backfill worker + live tail worker per chain (concurrent).
  - Backpressure: **bounded in‑memory queue per chain, drop‑oldest (pending only)**.

- **Guardrails**:

  - `feedsLength` max (default 10,000; configurable).
  - Max calldata size **128 KiB** (configurable).

- **Libraries/infra**:

  - RPC: **viem** (WS for live, HTTP for backfill/lookups).
  - DB: **Postgres**; migrations via **Drizzle**.
  - Deployment: single process (multi‑chain) **or** one process per chain (configurable).

---

## 3) Architecture

### 3.1 Components (Effect Layers & Fibers)

- **ConfigLayer**: Loads JSON file (no hot‑reload). Validates against JSON Schema.
- **ViemLayer**: Per‑chain `publicClient` (HTTP) + `webSocketClient` (WS). Rate limiting if configured.
- **VersionManager**:

  - On startup: backfill **Upgraded(address)** events from `startBlock` to head to compute current `version`.
  - Live: WS subscription to the proxy’s upgrade topic; on event, **increment version** and persist to DB.
  - Maintains in‑memory map: `chain_id → version`.
  - **DecoderProfiles** (code constants), e.g.:

    - `version 1: hasBlockNumber = true`
    - `version 2+: hasBlockNumber = false`
      (Extendable for future versions.)

- **LogIngestor (live)**:

  - WS filter on proxy `contractAddress` + `topic0 = keccak256(topicName)` (DataFeedsUpdated).
  - Collects `(blockNumber, logIndex, txHash)`, fetches `tx` and `receipt`, decodes calldata using `VersionManager` → `ParsedCalldata`.
  - Emits **ordered** per‑block batches to the per‑chain queue.

- **BackfillScanner**:

  - Scans `getLogs` from `startBlock` (contract deployment) to **current head − confirmations** with adaptive ranges.
  - Orders by block/log; uses same decode path; feeds the same queue.

- **OrderingBuffer**:

  - Ensures **strict (block_number, log_index)** ordering per chain.
  - Compacts out‑of‑order WS logs until gaps fill; bounded memory.

- **FinalityManager**:

  - Tracks `last_safe_block = head − confirmations`.
  - Assigns `state=pending` initially; flips to `confirmed` once beyond `last_safe_block`.
  - If a pending log disappears (reorg), mark `dropped`. Confirmed rows **remain confirmed** (no post‑confirm drops).

- **DBLayer**:

  - Drizzle models + raw SQL for partition/table DDL and UPSERTs.
  - Single **transaction per block** per chain to write: event, tx_input, normalized rows, and `feed_latest` updates.

- **MetricsLayer / LoggingLayer**:

  - `Effect.Tracing` spans wrap ingestion/backfill stages; span annotations feed the Prometheus metrics exporter.
  - JSON structured logs remain; OTLP span export only when the endpoint env is present.

- **TracingLayer**:

  - Uses `Effect.Metric` counters/histograms to track per-chain lag, queue depth, and error rates; metrics flow either to Prometheus or OTLP depending on runtime configuration.

- **Supervisor**:

  - One supervised **fiber per chain** for: backfill, live tail, version monitor.
  - Restart policies with jittered backoff.

### 3.2 Concurrency & Backpressure

- Per‑chain **BoundedQueue** (configurable; default 10,000 items). Overflow drops **oldest pending** items only (never confirmed). Metric + warning log on drops.

---

## 4) Data Model (Postgres)

> Separate databases per environment: `adfs_devnet`, `adfs_testnet`, `adfs_mainnet`.

### 4.1 Enumerations

```sql
CREATE TYPE adfs_state AS ENUM ('pending', 'confirmed', 'dropped');
```

### 4.2 Core Tables (partitioned where noted)

> Partitioning strategy: **LIST (chain_id)** → **RANGE (block_timestamp monthly)** on big tables.

#### `chains`

Reference metadata.

```sql
CREATE TABLE chains (
  chain_id        INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  finality_conf   INTEGER NOT NULL CHECK (finality_conf >= 0),
  start_block     BIGINT NOT NULL,
  contract_addr   BYTEA NOT NULL,        -- proxy address (20 bytes)
  topic_hash      BYTEA NOT NULL,        -- keccak256(DataFeedsUpdated(...))
  upgrade_topic   BYTEA NOT NULL,        -- keccak256("Upgraded(address)") default; overridable in code if needed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `contract_versions`

Tracks proxy upgrades and the **current version** per chain.

```sql
CREATE TABLE contract_versions (
  chain_id        INTEGER NOT NULL REFERENCES chains(chain_id),
  block_number    BIGINT NOT NULL,
  tx_hash         BYTEA  NOT NULL,
  log_index       INTEGER NOT NULL,
  implementation  BYTEA  NOT NULL,       -- address
  version         INTEGER NOT NULL,       -- monotonically increasing
  PRIMARY KEY (chain_id, block_number, log_index)
);

CREATE INDEX contract_versions_latest_idx ON contract_versions(chain_id, version DESC);
```

#### `events_adfs` (partitioned)

Raw log/event row for DataFeedsUpdated.

```sql
CREATE TABLE events_adfs (
  chain_id        INTEGER NOT NULL,
  block_number    BIGINT  NOT NULL,
  block_hash      BYTEA   NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  tx_hash         BYTEA   NOT NULL,
  log_index       INTEGER NOT NULL,
  topic0          BYTEA   NOT NULL,      -- keccak256(topicName)
  data            BYTEA   NOT NULL,      -- event data blob
  version         INTEGER NOT NULL,      -- from VersionManager at processing time
  state           adfs_state NOT NULL,   -- pending/confirmed/dropped
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, tx_hash, log_index)
) PARTITION BY LIST (chain_id);
```

> Subpartitions: each `events_adfs` child is RANGE partitioned by `block_timestamp` (monthly).

#### `tx_inputs` (partitioned)

Per-transaction input with decoded payload.

```sql
CREATE TABLE tx_inputs (
  chain_id        INTEGER NOT NULL,
  tx_hash         BYTEA   NOT NULL,
  "from"          BYTEA   NOT NULL,
  "to"            BYTEA   NOT NULL,
  nonce           BIGINT  NOT NULL,
  input           BYTEA   NOT NULL,      -- full calldata (cap at configured max)
  func_selector   BYTEA   NOT NULL,      -- first 4 bytes
  decoded         JSONB   NOT NULL,      -- ParsedCalldata JSON
  version         INTEGER NOT NULL,
  extra           JSONB   NULL,          -- version-specific extras
  block_number    BIGINT  NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  state           adfs_state NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, tx_hash)
) PARTITION BY LIST (chain_id);
```

#### `feed_updates` (partitioned, normalized)

One row per decoded **feed** update in the tx.

```sql
CREATE TABLE feed_updates (
  chain_id        INTEGER NOT NULL,
  block_number    BIGINT  NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  tx_hash         BYTEA   NOT NULL,
  log_index       INTEGER NOT NULL,

  stride          INTEGER NOT NULL CHECK (stride >= 0),
  feed_id         BIT(128) NOT NULL,     -- u128
  ring_index      INTEGER  NOT NULL CHECK (ring_index BETWEEN 0 AND 65535), -- u16
  data            BYTEA    NOT NULL,     -- feed payload
  version         INTEGER  NOT NULL,
  extra           JSONB    NULL,

  state           adfs_state NOT NULL,   -- pending/confirmed/dropped

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (chain_id, tx_hash, log_index, feed_id, stride, ring_index)
) PARTITION BY LIST (chain_id);
```

**Indexes**

```sql
-- Query support: latest & range lookups
CREATE INDEX feed_updates_feed_idx
  ON feed_updates (chain_id, feed_id, stride, block_number, log_index);

CREATE INDEX feed_updates_state_idx
  ON feed_updates (chain_id, state);
```

#### `ring_buffer_updates` (partitioned)

Normalized entries for `ringBufferTable[]` in the tx input.

```sql
CREATE TABLE ring_buffer_updates (
  chain_id        INTEGER NOT NULL,
  block_number    BIGINT  NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  tx_hash         BYTEA   NOT NULL,
  log_index       INTEGER NOT NULL,

  table_index     INTEGER NOT NULL CHECK (table_index BETWEEN 0 AND 65535), -- u16
  data            BYTEA   NOT NULL,
  version         INTEGER NOT NULL,
  extra           JSONB   NULL,
  state           adfs_state NOT NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (chain_id, tx_hash, log_index, table_index)
) PARTITION BY LIST (chain_id);
```

#### `feed_latest`

Latest **confirmed** value per `(chain_id, feed_id, stride)`.

```sql
CREATE TABLE feed_latest (
  chain_id        INTEGER NOT NULL,
  feed_id         BIT(128) NOT NULL,
  stride          INTEGER NOT NULL CHECK (stride >= 0),

  -- pointer to canonical source
  block_number    BIGINT  NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  tx_hash         BYTEA   NOT NULL,
  log_index       INTEGER NOT NULL,

  ring_index      INTEGER  NOT NULL CHECK (ring_index BETWEEN 0 AND 65535),
  data            BYTEA    NOT NULL,
  version         INTEGER  NOT NULL,
  extra           JSONB    NULL,

  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chain_id, feed_id, stride)
);
```

#### `processing_state`

Per‑chain cursors.

```sql
CREATE TABLE processing_state (
  chain_id          INTEGER PRIMARY KEY,
  last_seen_block   BIGINT NOT NULL DEFAULT 0,
  last_safe_block   BIGINT NOT NULL DEFAULT 0,
  backfill_cursor   BIGINT NOT NULL DEFAULT 0,  -- inclusive start for next backfill range
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **Note**: Partition DDL (LIST → monthly RANGE) should be created via migrations per chain and month; templates included in the repo.

---

## 5) Ingestion & Processing Flow

### 5.1 Startup

1. Load config and env; init DB; ensure partitions exist for the current month.
2. Build viem clients per chain (HTTP + WS).
3. **Version warmup**: scan `Upgraded(address)` events from `startBlock` → head; compute current **`version`** per chain; persist to `contract_versions`.
4. Initialize `processing_state` and **resume** backfill/live cursors.

### 5.2 Backfill (per chain; fiber)

- Range scan with `getLogs` (proxy address + `topic0 = keccak256(topicName)`) from `processing_state.backfill_cursor` up to `head − finality`.
- Adaptive step sizing (e.g., start 2,000 blocks; shrink on errors/timeouts).
- For each log:

  - Fetch tx (`eth_getTransactionByHash`) and header (`eth_getBlockByNumber`).
  - Derive `hasBlockNumber` from current **version** (VersionManager).
  - Decode calldata with `decodeADFSCalldata`; drop rows failing contract-level guardrails.

  - Emit to per-chain **OrderingBuffer**.

- Update `backfill_cursor` and `last_seen_block`/`last_safe_block`.

### 5.3 Live Tail (per chain; fiber)

- WS subscription on `(address=proxy, topics=[keccak256(topicName)])`.
- Buffer out‑of‑order logs until contiguous `(block_number, log_index)` order is achievable.
- For each log, fetch tx + header, decode, enqueue.

### 5.4 Per‑block DB Transaction (Writer)

For an ordered batch belonging to one **block**:

1. Upsert `events_adfs` `(chain_id, tx_hash, log_index)` with `state=pending`.
2. Upsert `tx_inputs` with raw `input`, `func_selector`, `decoded`, `version`, `extra`, `state=pending`.
3. Insert/Upsert `feed_updates` rows (one per decoded feed) with `state=pending`.
4. Insert/Upsert `ring_buffer_updates` rows (one per table entry) with `state=pending`.
5. Flip **`pending → confirmed`** if `block_number ≤ last_safe_block`, else stay pending. (Writers check `FinalityManager`.)
6. For rows confirmed in this block, **UPSERT** `feed_latest` on `(chain_id, feed_id, stride)` with the pointer `(block_number, log_index, rb_index, tx_hash, data, version)`.
7. Commit.

### 5.5 Reorgs

- If a **pending** log is orphaned before confirmation, mark its rows **`dropped`** (no delete).
- Confirmed rows are assumed final (no further drops).
- On deeper reorgs (beyond configured confirmations), the system **does not** replay automatically (per choice **b**); the live tail will emit the canonical logs, which will supersede content naturally via `feed_latest` UPSERTs.

---

## 6) Configuration

### 6.1 File (JSON) — no hot reload

```json
{
  "processMode": "multi",
  "chains": [
    {
      "name": "Ethereum",
      "chainId": 1,
      "rpcHttp": [
        "https://provider.example/http",
        "https://backup.example/http"
      ], // fallback order
      "rpcWs": ["wss://provider.example/ws"],
      "contractAddress": "0xProxyAddress",
      "topicName": "DataFeedsUpdated(uint256)",
      "startBlock": 19000000,
      "finality": 15,
      "rateLimits": { "rps": 20 },
      "backfill": { "initialRange": 2000, "minRange": 200, "maxRange": 5000 },
      "queue": { "maxItems": 10000 },
      "heartbeat": { "noEventsSeconds": 300, "maxLagBlocks": 64 }
    }
  ],
  "db": {
    "batch": { "maxInsert": 100 }, // default; tunable
    "migrations": { "tool": "drizzle" }
  },
  "observability": {
    "prometheus": { "port": 9464 },
    "logging": { "level": "info", "format": "json" }
  }
}
```

### 6.2 Secrets (env)

- `DB_URL` – Postgres connection string.
- `OTEL_EXPORTER_OTLP_ENDPOINT` (optional) – enables tracing if set.
- `RPC_*` keys if providers require them (can be embedded in URLs).

### 6.3 Process topology (configurable)

- `processMode`:

  - `"multi"` – one process handles all configured chains (default).
  - `"single"` – pin to one chain via `CHAIN_ID=...` env; deploy N processes (K8s or Docker Compose).

---

## 7) Decoding & Versioning

- **Decoder API**: `decodeADFSCalldata(calldata: string, hasBlockNumber?: boolean): ParsedCalldata`.
- **Version policy** (in code; no config):

  - Maintain `decoderProfiles: Record<number, { hasBlockNumber: boolean }>` with:

    - `1: { hasBlockNumber: true }`
    - `2: { hasBlockNumber: false }`
    - Extend as new ADFS versions ship.

- **Proxy upgrade tracking**:

  - Default monitor topic: `keccak256("Upgraded(address)")` on `contractAddress` (proxy).
  - On each upgrade event: increment `version` for that chain and persist to `contract_versions`.
  - All subsequent logs decode with the new `version`.

- **`extra` JSON**:

  - Any version‑specific fields beyond the common schema are placed in `extra`.
  - Example: `{ "sourceAccumulator": "0x..", "destinationAccumulator": "0x.." }` for versions without blockNumber.

---

## 8) APIs (DB‑centric for consumers)

> The indexer presents a **Prometheus** endpoint and optional admin CLI/HTTP (see §10). Consumers **read from Postgres**.

### 8.1 Common Queries (examples)

- **Latest value** (confirmed only):

  ```sql
  SELECT data, block_number, block_timestamp, version, extra
  FROM feed_latest
  WHERE chain_id = $1 AND feed_id = $2 AND stride = $3;
  ```

- **Updates in range**:

  ```sql
  SELECT *
  FROM feed_updates
  WHERE chain_id = $1
    AND feed_id  = $2
    AND stride   = $3
    AND state    = 'confirmed'
    AND block_number BETWEEN $4 AND $5
  ORDER BY block_number, log_index;
  ```

- **Ring buffer slot history**:

  ```sql
  SELECT *
  FROM ring_buffer_updates
  WHERE chain_id = $1
    AND table_index = $2
    AND state = 'confirmed'
  ORDER BY block_number, log_index;
  ```

- **Active feeds since X days** (filter latest by recency):

  ```sql
  SELECT feed_id, stride, data, block_number, block_timestamp, version
  FROM feed_latest
  WHERE chain_id = $1
    AND block_timestamp >= now() - ($2 || ' days')::interval; -- $2 = X
  ```

> **Note on BIT(128)**: bind `feed_id` using Postgres bit literals or cast from hex via a helper SQL function provided in migrations (e.g., `hex_to_bit128('0x...')`).

---

## 9) Idempotency, Ordering & Transactions

- **Uniqueness**: `(chain_id, tx_hash, log_index)` across event, input, and normalized tables.
- **Writer**: Opens one **transaction per block**:

  - UPSERT `events_adfs`, `tx_inputs`.
  - Insert/UPSERT `feed_updates`, `ring_buffer_updates`.
  - Flip state to `confirmed` if past safe block.
  - UPSERT `feed_latest` for confirmed rows.

- **Replays**: repeat processing of the same log/tx is safe due to UPSERTs; order is enforced by the OrderingBuffer.

---

## 10) Observability & Alerting

- **Metrics** (Prometheus):

  - `adfs_events_total{chain_id,state}`
  - `adfs_processing_lag_blocks{chain_id}`
  - `adfs_backfill_progress{chain_id}` (0..1)
  - `adfs_rpc_latency_ms{chain_id,method}` / `adfs_rpc_errors_total`
  - `adfs_db_latency_ms{op}` / `adfs_db_errors_total`
  - `adfs_queue_depth{chain_id}`
  - `adfs_reorgs_total{chain_id}`
  - `adfs_bytes_ingested_total{chain_id}`

- **Logging**: JSON with per‑record correlation (chain_id, block, tx_hash, log_index).
- **Tracing**: OTLP optional (enable if env present).
- **Alerts (Grafana)**:

  - No events on a chain for **5 min** (live mode).
  - Error rate > **2%** for **5 min**.
  - Lag > **64 blocks** for **2 min**.
  - Backfill progress unchanged for **10 min**.

---

## 11) Backpressure, Limits & Failure Policy

- **Queue**: bounded per chain; default `maxItems=10_000` (configurable). Overflow → **drop oldest PENDING** items with warning + metric.
- **Guardrails**:

  - `feedsLength` > configured max → **skip tx** (record an **anomaly** event).
  - Calldata size > **128 KiB** (configurable) → **skip tx**.

- **Retries**: Exponential backoff with jitter; cap at **5 minutes** per call before surfacing an error metric and yielding the fiber.

---

## 12) Security & Access

- Network via **Tailscale**; minimal egress.
- DB roles:

  - **writer**: indexer service account.
  - **reader**: downstream services (read‑only, GRANT SELECT on partitions & views).

- No PII; standard retention policies (tunable later).

---

## 13) Deployment & Operations

- **Packaging**: Docker image.
- **Modes**:

  - **Multi‑chain** (one process) or **single‑chain** (one process per chain) via config.

- **Migrations**: **Drizzle**:

  - Creates base tables, enums, helper functions (e.g., `hex_to_bit128`), and rolling monthly partitions.

- **Zero‑downtime**:

  - Additive schema changes only; online index creation (`CONCURRENTLY`); no table rewrites during business hours.

- **Postgres**:

  - v14+ recommended; managed HA optional (single instance acceptable for v1).

---

## 14) Testing Strategy

- **Unit**: decoding (`decodeADFSCalldata`) incl. stride/table_index derivations; version profile selection.
- **Integration**: viem (HTTP/WS) ↔ DB; end‑to‑end ingestion with a local devnet.
- **Reorg simulation**: forked chain that rewinds < confirmations to verify `pending → dropped` and stability of `confirmed`.
- **Load**: synthetic logs to validate QPS, queue backpressure, and batch write performance.
- **Fixtures**: sample calldata for both version profiles; upgrade event streams.

---

## 15) Admin Surfaces

- **CLI / admin HTTP** (minimal for v1):

  - `backfill --chain <id> --from <block> --to <block>` (ad‑hoc range).
  - `state --chain <id>` (cursors, lag, version).
  - `partitions create --month <YYYY-MM>` (pre‑create monthly partitions).

---

## 16) Runbooks

1. **RPC outage**

   - Symptoms: rising `adfs_rpc_errors_total`, lag growth.
   - Actions: switch provider URL in config; restart process. Reduce `backfill.initialRange`. Verify WS reconnects.

2. **DB saturation**

   - Symptoms: high `adfs_db_latency_ms`, queue growth.
   - Actions: increase `db.batch.maxInsert` moderately; scale DB IOPS; consider per‑chain processes; add indexes if missing.

3. **Stuck backfill**

   - Symptoms: `adfs_backfill_progress` flat > 10 minutes.
   - Actions: check provider rate limits; reduce range; restart backfill CLI with narrower windows.

---

## 17) Delivery Plan & Milestones

- **M1 – Skeleton & Config (Week 1)**

  - Effect scaffolding, config loader, Drizzle migrations (base + partitions), viem clients, Prometheus/JSON logs.

- **M2 – Versioning & Live Tail (Week 2)**

  - VersionManager (Upgraded events), decoder profiles, WS tail, per‑block writer (pending states).

- **M3 – Backfill & Finality (Week 3)**

  - Range scanner, OrderingBuffer, pending→confirmed flips, reorg handling, `feed_latest` maintenance.

- **M4 – Normalization & Limits (Week 4)**

  - `feed_updates`, `ring_buffer_updates`, guardrails, anomaly telemetry.

- **M5 – Hardening & Tests (Week 5)**

  - Unit/integration/reorg/load tests; runbooks; Grafana dashboards.

- **M6 – Launch (Week 6)**

  - Devnet → testnet → mainnet rollouts; SLO baselining; on‑call rotation.

---

## 18) Schema & Migration Notes (Drizzle)

- Use `enum('adfs_state', ['pending','confirmed','dropped'])`.
- Partition helpers:

  - For each `chain_id`, create a LIST partition; under it, create monthly RANGE partitions (e.g., `2025_09`).
  - Migrations include a job to pre‑create partitions for **current + next 3 months** per chain.

- Provide a `hex_to_bit128(hex TEXT) RETURNS BIT(128)` SQL function to ease client inserts and filters.

---

## 19) SLOs (initial baseline — can tighten later)

- **Freshness** (live): _p50_ ≤ 5s, _p95_ ≤ 30s from block inclusion to **pending** write; **confirmed** within `finality` window.
- **Durability**: ≥ 99.9% successful confirmed writes/day.
- **Availability**: ingestion loop ≥ 99.9% (excluding provider outages).

---

## 20) Assumptions & Defaults

- Proxy conforms to ERC‑1967 `Upgraded(address)`; if a chain uses a non‑standard upgrade event, a code override can register an alternate topic hash.
- Event signature for **DataFeedsUpdated** is stable across versions; if it changes, update `topicName` in config (multiple topics supported internally by deriving `topic0` per signature).
- `stride` non‑negative; `u16` indices never exceed 65535.
- Consumers use read‑only DB credentials.

---

## 21) Open Implementation Details (tracked in repo issues)

- [ ] Provide helper SQL functions and views for **BIT(128)** ergonomics (hex in/out).
- [ ] Optional materialized views for **recent updates per feed** to speed dashboards.
- [ ] Toggle to run **single‑chain** processes via env without editing JSON config.

---

### Appendix A — State Machine

```
ingest log -> write pending rows (event, tx_input, feeds, ring_table)
if block_number <= last_safe_block: flip to confirmed; upsert feed_latest
on reorg (before confirmation): mark those rows dropped
confirmed rows are never dropped (assumed final)
```

### Appendix B — Example Partition DDL (per chain, per month)

```sql
-- LIST partition for chain 1
CREATE TABLE events_adfs_c1 PARTITION OF events_adfs FOR VALUES IN (1) PARTITION BY RANGE (block_timestamp);
-- Subpartition for Sep 2025
CREATE TABLE events_adfs_c1_2025_09 PARTITION OF events_adfs_c1
  FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
-- Repeat for tx_inputs, feed_updates, ring_buffer_updates
```

---

This specification encodes all of your choices (versioned decoding, soft‑delete via states, normalized + latest tables, per‑chain ordering, backfill/live, Drizzle migrations, and operational posture). If you want, I can next turn this into:

- a **config JSON schema**,
- initial **Drizzle models/migrations**, and
- a **starter Effect program** skeleton with supervisors, queues, and workers.
