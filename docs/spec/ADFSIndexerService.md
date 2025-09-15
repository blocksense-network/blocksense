Below is a complete, implementation‑ready **software specification** for your multichain EVM indexing service built with **Node.js + TypeScript + Effect** and **viem**, persisting into **PostgreSQL**. It encodes all choices you provided; places where you passed are filled with reasonable, clearly‑marked defaults that you can change before coding.

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

- **Event topic**: configured as `topicHash` (no indexed params).
- **Tx input**: fetch for each matched log; decode using `decodeADFSCalldata(calldata, hasBlockNumber)`:

  - The service decides `hasBlockNumber` **by contract version**, not config.

- **Decoded structure** (you provided):

  - `feeds[]` items expose `stride`, `feedIndex`, and **always** `feedId` (u128) and `index` (u16), plus `data` (bytes).
  - `ringBufferTable[]` items expose `index` (global table index) and `data` (bytes).

- **Source of truth for block number**: **event data** (answer “1 = A”).
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

  - `maxFeedsLength` (default **10,000**, configurable).
  - `maxCalldataBytes` (configurable, **128 KB** default).
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
|                     Indexer Process (Effect runtime)                |
|                                                                      |
|  Layers:                                                             |
|  - ConfigLayer       (JSON -> types, no hot reload)                  |
|  - RpcLayer          (viem clients: HTTP + WS)                       |
|  - DbLayer           (Postgres pool)                                 |
|  - MetricsLayer      (Prometheus)                                    |
|  - LogLayer          (JSON logs)                                     |
|  - TracingLayer      (OTel)                                          |
|                                                                      |
|  Supervisors:                                                        |
|  - ChainRuntime[chain]                                               |
|     * BackfillWorker (HTTP getLogs)                                  |
|     * LiveTailWorker (WS watchLogs)                                  |
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

- **WS**: subscribe to `topicHash` logs for the proxy/contract (live tail).
- **HTTP**: backfill ranges + `getTransaction` for calldata; `getBlock` for timestamp/hash.
- **Proxy upgrade**: watch **TransparentUpgradeableProxy** `Upgraded(address)` logs from the proxy address and bump `version`.

---

# 4) Data model (PostgreSQL)

All binary data uses **BYTEA**. Addresses are stored as 20‑byte `BYTEA`. Timestamps as `TIMESTAMPTZ`. Integers:

- `feed_id`: **BIT(128)** (per your choice).
- `feed_index` (ring buffer index **within feed**): `SMALLINT` (u16).
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
  topic_hash      BYTEA NOT NULL,             -- 32 bytes
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
  topic_hash      BYTEA   NOT NULL,           -- redundancy for audit
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
  feed_index      SMALLINT NOT NULL,          -- ring buffer index within feed (u16)
  data            BYTEA NOT NULL,
  extra           JSONB   NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (chain_id, tx_hash, log_index, feed_id, feed_index)
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

- On **confirm** of a `feed_updates` row, perform an **UPSERT** into `feed_latest` keyed by `(chain_id, feed_id, stride)`, choosing the max `(block_number, log_index)` if there’s contention.
- `feed_latest` contains **confirmed rows only** and stores the last `block_timestamp` for recency filters.
- Consumers may apply an optional "active since X days" filter using `block_timestamp ≥ now() - interval 'X days'`.

### 4.4 Ring buffer addressing (for random reads)

- Given `(feedId, indexWithinFeed, stride)`, compute the global **table index**:

  ```
  feedIndex = ((feedId << 13) + indexWithinFeed) << stride
  ```

- To support **random historical reads**, queries compute that `feedIndex` and look up in `ring_buffer_writes (table_index)`.
- We index `ring_buffer_writes` on `(chain_id, table_index, block_number DESC)` to get newest‑first results for any slot.

---

# 5) Reorg & finality policy

- **Uniqueness key**: `(chain_id, tx_hash, log_index)` (answer “2 = Yes”).
- **Pending window**: rows remain `pending` until confirmed depth is reached.
- **Reorg handling** (answer “3 = b”):

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

  - One **backfill worker per chain** scanning `getLogs` from `startBlock` with adaptive ranges (start at 2k blocks; shrink on RPC errors).
  - Backfill and live tail run concurrently; the writer enforces ordering.

- **DB writes**:

  - **One DB transaction per block per chain** (answer “15”).
  - `UPSERT` everywhere to ensure idempotency.

- **Batching defaults** (fill for “16 pass”):

  - `db_write_batch_rows`: **200** rows per insert/UPSERT statement (configurable).

- **Backpressure** (answer “17 yes”, “18 yes”, “19 config option”):

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

**Format**: **JSON file**, **no hot reload** (answer “22”).
**Secrets** via **env** (DB URL, RPC keys).
**Separate config files** per environment; **separate Postgres databases** (answer “24”).

### 8.1 JSON schema (logical)

```json
{
  "service": {
    "mode": "multi|single", // allows multichain in one process or one chain per process
    "queueMaxItems": 10000, // default; drop-oldest policy
    "dbWriteBatchRows": 200,
    "maxCalldataBytes": 131072, // 128 KB default
    "maxFeedsLength": 10000 // anomaly guard
  },
  "chains": [
    {
      "chainId": 1,
      "name": "ethereum",
      "rpcHttp": "https://.../",
      "rpcWs": "wss://.../",
      "finality": 12,
      "contractAddress": "0xProxyAddress", // proxy
      "topicHash": "0x...", // DataFeedsUpdated...
      "startBlock": 12345678
    }
    // more chains...
  ]
}
```

> `hasBlockNumber` **not** in config (derived by version).
> **Rate limits** and **max queue size** are optional config knobs; defaults provided.

**Env variables**:

- `PG_URL` (writer)
- `PG_URL_RO` (read-only for consumers)
- `RPC_KEY_*` (if provider requires keys)
- `OTEL_EXPORTER_OTLP_ENDPOINT` (when provided)
- `LOG_LEVEL` (`info` default)

---

# 9) Effect runtime design (Node + TS)

### 9.1 Layers

- **ConfigLayer**: parses JSON, validates against schema.
- **RpcLayer**: builds per‑chain viem clients (`publicClient` HTTP + `webSocketClient`).
- **DbLayer**: `pg` pool with tuned pool size; exposes repo methods (idempotent UPSERTs).
- **MetricsLayer**: Prometheus registry + HTTP endpoint `/metrics`.
- **LogLayer**: JSON structured logging (`pino` or `console` wrapper).
- **TracingLayer**: OpenTelemetry instrumentation; OTLP export if endpoint present.

### 9.2 Fibers per chain

- **BackfillWorker**: sequential ranges; emits decoded rows to ordering buffer.
- **LiveTailWorker**: WS `watchLogs` subscription; fetch `tx`, `calldata`, `block`.
- **ProxyUpgradeWatcher**: subscribes to proxy `Upgraded` events; persists `proxy_versions`.
- **OrderingBuffer**: merges backfill and live tail, enforces per‑block total order.
- **Writer**: one DB transaction per block; writes `adfs_events`, `feed_updates`, `ring_buffer_writes`, and maintains `feed_latest`; flips `pending → confirmed` on finality.

---

# 10) Event processing flow

1. **Detect** matching log (topic = `topicHash`, address = proxy/contract).
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
(chain_id, feed_id, stride, block_number, block_timestamp, block_hash, tx_hash, log_index, data, version)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
ON CONFLICT (chain_id, feed_id, stride)
DO UPDATE SET
  block_number = EXCLUDED.block_number,
  block_timestamp = EXCLUDED.block_timestamp,
  block_hash   = EXCLUDED.block_hash,
  tx_hash      = EXCLUDED.tx_hash,
  log_index    = EXCLUDED.log_index,
  data         = EXCLUDED.data,
  version      = EXCLUDED.version
WHERE (fl.block_number, fl.log_index) < (EXCLUDED.block_number, EXCLUDED.log_index);
```

- **Idempotency**:

  - `adfs_events`: `PRIMARY KEY (chain_id, tx_hash, log_index)`.
  - `feed_updates`: add composite PK including `feed_id` and `feed_index`.
  - `ring_buffer_writes`: PK includes `table_index`.

---

# 12) Observability & alerting

### 12.1 Metrics (Prometheus)

- `events_processed_total{chain,status}`
- `events_lag_blocks{chain}` (head − last_seen_block)
- `finality_lag_blocks{chain}` (head − last_finalized_block)
- `rpc_requests_total{chain,method,outcome}` / `rpc_latency_ms_bucket`
- `db_ops_total{op}` / `db_latency_ms_bucket`
- `reorgs_pending_dropped_total{chain}`
- `bytes_ingested_total{chain}`
- `backfill_progress{chain}` (last_backfill_block / target)
- `queue_depth{chain}`

### 12.2 Alerts (accepted defaults)

- No events on a chain **5 min**.
- Error rate > **2%** for **5 min**.
- Lag > **64 blocks** for **2 min**.
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
- **Modes** (answer “33”):

  - `--mode=multi` (all chains in one process).
  - `--mode=per-chain --chainId=...` (one process per chain).

- **Kubernetes or Compose**: both supported; health/readiness endpoints:

  - `/healthz` (process + DB ping)
  - `/readyz` (initial backfill not required to be “ready”).

- **Postgres HA**: “OK” for managed HA; otherwise single instance acceptable initially (answers “34 ok”, “35 ok” = online‑safe migrations only).
- **Runbooks** (answer “32 yes”):

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
-- Compute table_index in app: ((feedId << 13) + indexWithinFeed) << stride
SELECT block_number, block_timestamp, data
FROM   ring_buffer_writes
WHERE  chain_id = $1 AND table_index = $2
  AND  status = 'confirmed'
ORDER BY block_number DESC
LIMIT 1;
```

---

# 17) Defaults & tunables (filled where you passed)

- `db_write_batch_rows`: **200**
- `queue_max_items`: **10,000**
- `maxCalldataBytes`: **131,072** (128 KB)
- `maxFeedsLength`: **10,000**
- Backfill range step: start **2,000** blocks; shrink to **256** on error
- Confirmations per chain: from config
- Metrics endpoint: `:8080/metrics`
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

- Admin API/CLI (you answered “no”).
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
  topicHash: `0x${string}`;
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
  feedIndex: number; // u16
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

---

If you want, I can follow this with a **scaffolded project structure**, initial **SQL migration files**, and **Effect layer skeletons** that conform 1:1 to this spec.

# EVM Multichain Indexing Service — Software Specification

_Target stack: Node.js + TypeScript + Effect (v3+), viem, Postgres. Revision: 2025‑09‑02._

---

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

## 2) Key Requirements (from answers)

- **Sync target**: DB is the source for downstream services.
- **Backfill**: Yes, from deployment block.
- **Finality**: Per‑chain confirmations from config; state: `pending | confirmed | dropped`.
- **Contracts**: One proxy‑fronted ADFS per chain; **monitor the proxy** address.
- **Event meta**: `topicHash` in config (DataFeedsUpdated topic).
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

  - WS filter on proxy `contractAddress` + `topicHash` (DataFeedsUpdated).
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

  - Prometheus endpoint; JSON structured logs.
  - Optional OTLP tracing (disabled unless endpoint env is present).

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
  topic0          BYTEA   NOT NULL,      -- topicHash
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

  PRIMARY KEY (chain_id, tx_hash, log_index, feed_id, ring_index)
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

- Range scan with `getLogs` (proxy address + `topicHash`) from `processing_state.backfill_cursor` up to `head − finality`.
- Adaptive step sizing (e.g., start 2,000 blocks; shrink on errors/timeouts).
- For each log:

  - Fetch tx (`eth_getTransactionByHash`) and header (`eth_getBlockByNumber`).
  - Derive `hasBlockNumber` from current **version** (VersionManager).
  - Decode calldata with `decodeADFSCalldata`; validate guardrails:

    - `feedsLength ≤ maxFeedsLength`; `input.length ≤ maxCalldataSize`.

  - Emit to per‑chain **OrderingBuffer**.

- Update `backfill_cursor` and `last_seen_block`/`last_safe_block`.

### 5.3 Live Tail (per chain; fiber)

- WS subscription on `(address=proxy, topics=[topicHash])`.
- Buffer out‑of‑order logs until contiguous `(block_number, log_index)` order is achievable.
- For each log, fetch tx + header, decode, enqueue.

### 5.4 Per‑block DB Transaction (Writer)

For an ordered batch belonging to one **block**:

1. Upsert `events_adfs` `(chain_id, tx_hash, log_index)` with `state=pending`.
2. Upsert `tx_inputs` with raw `input`, `func_selector`, `decoded`, `version`, `extra`, `state=pending`.
3. Insert/Upsert `feed_updates` rows (one per decoded feed) with `state=pending`.
4. Insert/Upsert `ring_buffer_updates` rows (one per table entry) with `state=pending`.
5. Flip **`pending → confirmed`** if `block_number ≤ last_safe_block`, else stay pending. (Writers check `FinalityManager`.)
6. For rows confirmed in this block, **UPSERT** `feed_latest` on `(chain_id, feed_id, stride)` with the pointer `(block_number, log_index, tx_hash, ring_index, data, version, extra)`.
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
      "rpcHttp": "https://provider.example/http",
      "rpcWs": "wss://provider.example/ws",
      "contractAddress": "0xProxyAddress",
      "topicHash": "0x<keccak256_of_DataFeedsUpdated_signature>",
      "startBlock": 19000000,
      "finality": 15,
      "rateLimits": { "rps": 20 },
      "backfill": { "initialRange": 2000, "minRange": 200, "maxRange": 5000 },
      "queue": { "maxItems": 10000 }
    }
  ],
  "limits": {
    "maxFeedsLength": 10000,
    "maxCalldataBytes": 131072
  },
  "db": {
    "batch": { "maxInsert": 100 }, // default; tunable
    "migrations": { "tool": "drizzle" }
  },
  "observability": {
    "prometheus": { "port": 9464 },
    "logging": { "level": "info", "format": "json" },
    "alerts": {
      "noEventsMinutes": 5,
      "errorRatePct": 2,
      "errorRateWindowMinutes": 5,
      "maxLagBlocks": 64,
      "maxLagWindowMinutes": 2,
      "backfillStallMinutes": 10
    }
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

- **Unit**: decoding (`decodeADFSCalldata`) incl. stride/feedIndex derivations; version profile selection.
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
- Event signature for **DataFeedsUpdated** is stable across versions; if it changes, add another `topicHash` in config for that chain (multiple topics supported internally).
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
