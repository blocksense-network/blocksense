## General E2E Scenario

Purpose

- Validate the end-to-end behavior of the Blocksense stack on a local fork using `process-compose`.
- Ensure the `Sequencer` and `Reporter` operate correctly and that on-chain data updates as expected.

What this test does (high level)

- Boots the `e2e-general` environment (via the process-compose environment manager). The test runner sets `FEEDS_CONFIG_DIR` to this folder.
- Uses `environment-setup.nix` to define services (Anvil, Sequencer, Reporter, etc.) and reads runtime artifacts from `config/generated/process-compose/e2e-general/`.
- Polls `process-compose` and asserts early process statuses match `expected-service-status.ts`.
- Fetches `Sequencer` config and feeds config, derives contract address, and selects feed IDs.
- Captures initial feed rounds/values; enables the provider for `ink_sepolia`.
- Waits until each feed has at least 2 updates (via metrics), re-validates process status.
- Verifies on-chain values updated correctly and cross-checks against `Sequencer` aggregate history.
- Posts sample reports (`Numerical`, `Text`, `Bytes`, `APIError`, `UndefinedError`) and asserts network updates increase.
- Scans `Reporter` logs to ensure there are no panics and no non-200 responses from the `Sequencer`.

How to run

- From the repo root:

```bash
just test-e2e
```

Or you can start a custom test-scenario environment via `just start-environment e2e-general`

Notes

- Tests run sequentially to avoid interference.
- Environment name: `e2e-general`.
- Logs are located under `logs/process-compose/e2e-general/`.
- You can stop the environment with `just stop-environment` or `Ctrl+C`.
