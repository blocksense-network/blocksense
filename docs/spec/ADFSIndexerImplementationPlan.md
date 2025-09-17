# ADFS Indexer: Implementation Plan

This document outlines the development steps to build the ADFS Indexer service based on the provided software specification. The project will be broken down into milestones, each with a clear set of tasks.

## Milestone 1: Project Scaffolding & Core Layers

**Goal:** Set up the basic project structure, install dependencies, and implement the core service layers using Effect.

1.  **Initialize Project:**

    - Create a new directory: `apps/adfs-indexer`.
    - Initialize a new Node.js project: `pnpm init`.
    - Setup TypeScript with a `tsconfig.json` that aligns with the Effect ecosystem.
    - Setup `tsup` for building and `vitest` for testing, similar to other `apps/*` in the monorepo.

2.  **Install Dependencies:**

    - **Core:** `@effect/io`, `@effect/data`, `@effect/schema`, `@effect/platform`, `@effect/platform-node`.
    - **EVM:** `viem`, `abitype`.
    - **Database:** `pg`.
    - **Observability:** `@effect/opentelemetry` for tracing/metrics.

3.  **Configuration Model:**

    - Define Effect `Schema` for all configuration files and environment variables. This includes chain definitions, RPC URLs, contract addresses, topic names, and secrets.
    - Implement a `ConfigLayer` that loads, validates, and provides this configuration to the application.

4.  **Database Setup:**

    - Write SQL migration scripts (e.g., using a library like `node-pg-migrate`) for the DDL in the specification (`chains`, `contracts`, `proxy_versions`, `adfs_events`, `feed_updates`, `ring_buffer_writes`, `feed_latest`, `processing_state`).
    - Implement a `DbLayer` that provides an Effect-managed `pg` connection pool.

5.  **Core Service Layers:**
    - **RpcLayer:** Create a service that provides `viem` HTTP and WebSocket clients for each configured chain.
    - **Logging/Metrics/Tracing Layers:** Set up basic observability using Effect's built-in capabilities and OpenTelemetry integration.

## Milestone 2: Data Ingestion Pipeline

**Goal:** Implement the core logic for fetching and processing EVM logs for a single chain.

1.  **Backfill Worker:**

    - Implement a worker that uses `viem`'s `getLogs` over HTTP to fetch historical events in batches.
    - It should read its starting point from the `processing_state` table (`last_backfill_block`) and the contract's `startBlock`.
    - It will stream logs into an in-memory `Queue`.

2.  **Live Tail Worker:**

    - Implement a worker that uses `viem`'s `watchEvent` (or `watchLogs`) over WebSocket to subscribe to new events.
    - It should also stream these logs into the same in-memory `Queue`.

3.  **Ordering & Buffering:**

    - Create an `OrderingBuffer` service that consumes from the `Queue`.
    - Its responsibility is to handle out-of-order events from the live tail and ensure logs are processed strictly by `blockNumber` and `logIndex`.

4.  **Event Processor:**
    - For each log, fetch the full transaction using `getTransaction`.
    - Decode the transaction calldata using the `decodeADFSCalldata` function (this function needs to be implemented or imported).
    - The processor should be aware of the contract `version` to determine if `has_block_number` is true for decoding.
    - Transform the raw log and decoded data into the structures required for the `adfs_events`, `feed_updates`, and `ring_buffer_writes` tables.

## Milestone 3: Database Persistence & State Management

**Goal:** Write the processed data to PostgreSQL and manage the state of indexed blocks.

1.  **Database Writer:**

    - Create a `Writer` service that consumes processed data from the event processor.
    - It will batch records and perform `UPSERT` operations into the `adfs_events`, `feed_updates`, and `ring_buffer_writes` tables. All initial writes will have the `status = 'pending'`.
    - The `UPSERT` will use the natural primary keys (`(chain_id, tx_hash, log_index)`, etc.) to ensure idempotency.

2.  **Finality & Reorg Handling:**

    - Implement a process that runs periodically to check for finality.
    - For blocks that are now "final" (i.e., `current_block - block_number > finality_conf`), it will:
      - Update the `status` of rows from `pending` to `confirmed`.
      - On confirmation, `UPSERT` the corresponding records into the `feed_latest` materialized view.
    - Implement reorg detection: if a `pending` log's block hash no longer matches the canonical chain, update its `status` to `dropped`.

3.  **Cursor Management:**
    - The `Writer` will update the `processing_state` table after each successful batch write, advancing `last_seen_block`, `last_finalized_block`, and `last_backfill_block` as appropriate.

## Milestone 4: Advanced Features & Supervision

**Goal:** Add multi-chain support, proxy upgrade handling, and robust supervision.

1.  **Multi-Chain Supervisor:**

    - Create a top-level supervisor program.
    - Based on the configuration, it will spawn and supervise a complete "Chain Runtime" (Backfill + LiveTail + Processor + Writer) for each configured chain.
    - This enables parallel indexing across all chains.

2.  **Proxy Upgrade Watcher:**

    - Implement a separate worker that subscribes to the `Upgraded(address)` event on the configured proxy contract address.
    - When an upgrade is detected, it will write a new entry to the `proxy_versions` table.
    - The `Event Processor` will consult this table to tag incoming events with the correct `version`.

3.  **Application Entrypoint:**
    - Create the main `index.ts` file.
    - This file will compose the full Effect program: initialize layers, start the multi-chain supervisor, and handle graceful shutdowns.

## Milestone 5: Testing & Deployment

**Goal:** Ensure the service is reliable and ready for deployment.

1.  **Unit & Integration Tests:**

    - **Unit Tests:** Write `vitest` tests for pure logic, such as the calldata decoding function and data transformations.
    - **Integration Tests:**
      - Use a test database to verify the entire pipeline: from mock RPC events to final `confirmed` rows in `feed_latest`.
      - Test the reorg handling logic by simulating a fork.
      - Test the proxy upgrade detection and versioning.

2.  **Observability Dashboards:**

    - Define key metrics to export (e.g., `indexer_last_processed_block`, `indexer_event_queue_size`, `db_write_latency_seconds`).
    - Create a basic Grafana dashboard to visualize these metrics.

3.  **Deployment:**
    - Create a `Dockerfile` for containerizing the application.
    - Write deployment scripts or a Helm chart for deploying to Kubernetes.
    - Document the required environment variables and configuration for `devnet`, `testnet`, and `mainnet` environments.
