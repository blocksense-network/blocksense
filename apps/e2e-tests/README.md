## End-to-End Tests

This package hosts end-to-end tests that launch a local Blocksense stack and verify the system end to end (`Sequencer`, `Reporter`, `Anvil`, etc.). Tests are implemented with `Vitest` and `Effect`.

### Project structure

Each test scenario should be located in `apps/e2e-tests/src/test-scenarios/` and have the following structure:

- `e2e.spec.ts`: The scenario’s test file.
- `environment-setup.nix`: Nix module configuring the services for the scenario (`services.blocksense.*`).
- `feeds_config_v2.json`: Scenario-specific feeds config consumed by the `Sequencer`. The test runner exports `FEEDS_CONFIG_DIR` to this folder before starting the environment.
- `expected-service-status.ts`: Expected `process-compose`/`systemd`/`docker` process statuses used by assertions.

The utilities are organized as follows:

- `src/utils/`
  - `environment-managers/process-compose-manager.ts`: Starts/stops the process-compose environment via `Just`, exposes process status, and sets `FEEDS_CONFIG_DIR` to the scenario folder. Future environment managers may include `systemd` and `docker`.
  - `services/*`, `metrics/*`, `utilities*`: Helpers for calling services, fetching metrics, and small utilities used by the scenarios.

### Environment variables

Put environment variables at the repository root in an `.env` file. For a reference template, see the `.env.example` at the repo root (look for the "E2E Tests" section near the end).

At a minimum, e2e tests require RPC URLs for networks used by the scenario. For example, the `general` scenario expects `RPC_URL_INK_SEPOLIA` (used by the Anvil fork in `environment-setup.nix`).

```
# Example Environments and E2E Tests Variables
ALCHEMY_API_KEY="<ALCHEMY_API_KEY>"
RPC_URL_INK_SEPOLIA="<RPC_URL_INK_SEPOLIA>"
RPC_URL_ETHEREUM_SEPOLIA="<RPC_URL_ETHEREUM_SEPOLIA>"
```

### How to run

From the repo root, run:

```bash
just test-e2e
```

This runs the `@blocksense/e2e-tests` workspace scenario tests. Currently, there is only one test scenario - `general`. The test suite automatically:

- Builds the `process-compose` environment artifacts
- Starts the `e2e-general` environment in detached mode
- Executes the tests
- Stops the environment on completion (or on SIGINT)

Or you can start a custom test-scenario environment via `just start-environment e2e-<scenario>`

_Note: For each test scenario, we create an environment prefixed with `e2e-`, which separates e2e-test-related environments from debugging ones (e.g., `example-setup-0x`)._

You can stop the environment manually if needed:

```bash
just stop-environment
```

or via `Ctrl+C`

### What gets generated

- `config/generated/process-compose/<environment>/` (created by the test runner via `just start-environment`):
  - `process-compose.yaml`: The process-compose definition for the environment.
  - `available-ports`: A list of free local ports collected for the environment (used by Nix config).
  - `anvil/state.json`: Anvil snapshot/state used by the local EVM fork (path referenced in `environment-setup.nix`).
  - Other service-specific files are copied from the Nix build output for the selected environment.
  - See `config/generated/README.md` for the broader description of generated/symlinked config files such as `sequencer_config.json` and `reporter_config_<name>.json`.

Logs are written under `logs/process-compose/<environment>/` (configured in `environment-setup.nix`).

### Conventions

- Tests run sequentially: use `describe.sequential` to avoid cross-test interference with shared services. <br> _Note: Parallel execution of test scenarios is planned._
- Follow the existing pattern: each test (`it.live(...)`) should represent one effect/behavior and be self-contained.
- Use the Effect style (`Effect.gen`, layers) as in the existing tests.
- Keep scenario-specific configuration in the scenario folder. If you add a new scenario, mirror the `general/` folder structure and set a distinct environment name.

### Notes for contributors

- The environment manager sets `FEEDS_CONFIG_DIR` to the current scenario directory before starting `process-compose`.
- The `test-e2e` flow uses `vitest` under the hood and will type-check as part of the run.
- Nix automatically scans for newly created test scenarios and creates an `e2e-<scenario>` environment only if there is a dedicated `environment-setup.nix` config file.

### Troubleshooting

- If the `process-compose` instance blinks and disappears, it likely indicates a setup issue (usually `anvil` fails to start, and all other processes depend on it).
