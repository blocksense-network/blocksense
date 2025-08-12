# **Blocksense SDK Documentation: The blocksense CLI**

Welcome to the official documentation for the blocksense command-line interface (CLI). This tool is the cornerstone of the Blocksense SDK, providing a unified and intuitive command center for the entire development lifecycle—from project creation to on-chain deployment and upgrades.

The blocksense CLI is designed to streamline the development of both Intersubjective Services (Oracle Services) and Objective Programs (ZK Circuits), abstracting away low-level complexities and enabling you to focus on building powerful, verified applications.

## **Guiding Principles**

The design of the blocksense CLI is guided by several core principles:

- **Developer-Centricity:** Every command and option is designed to be intuitive, with clear and actionable feedback.
- **Unified Tooling:** A single, consistent interface (blocksense) manages all aspects of your project, preventing toolchain fragmentation.
- **Platform-Native Abstraction:** The CLI provides high-level commands that map directly to the powerful, unique features of the Blocksense network.
- **Uncompromising Security:** Secure defaults and best practices are integrated directly into the CLI's workflow.

## **Global Options**

These options can be used with any blocksense command.

- `--help`, `-h`: Displays help information for the specified command.
- `--version`, `-V`: Displays the current version of the blocksense CLI.

---

## **Command Reference**

The following sections provide a detailed reference for each of the main blocksense commands.

### **blocksense init**

Initializes a new Blocksense project from a predefined or custom template. This command scaffolds a complete directory structure, including boilerplate code and configuration files, so you can start developing immediately.

**Usage:**

```bash
blocksense init <TEMPLATE> <PROJECT_NAME>
```

**Arguments:**

- `<TEMPLATE>`: The name of the template to use. This can be one of the official templates or a URL to a custom Git repository.
- `<PROJECT_NAME>`: The name of the new directory to create for your project.

**Official Templates:**

- `oracle-service-rust`: A minimal "hello world" Intersubjective Service in Rust, including a basic query function and unit test.
- `price-feed-oracle`: A comprehensive price feed example demonstrating API fetching, advanced consensus models, and caching.
- `objective-program-noir`: A minimal ZK circuit project using Blocksense Noir, including a simple circuit and test case.
- `zk-identity-service`: A template for building a custom, ZK-powered identity service, showcasing the authorize_user API.
- `full-stack-dapp`: A complete end-to-end example including an oracle service, an objective program, a frontend, and localnet configuration.

**Output:**

The init command generates a new directory containing the selected template's files and a central `Blocksense.toml` configuration file. This manifest is used to configure builds, tests, deployments, and local network settings.

### **blocksense build**

Compiles all components within a project directory into deployable artifacts. The command automatically detects whether to build an Intersubjective Service or an Objective Program based on the project's structure and configuration.

**Usage:**

```bash
blocksense build
```

**Arguments:**

- `<PATH>` (Optional): The path to the project or component to build. Defaults to the current directory.

**Behavior:**

- **For Intersubjective Services (Rust):** Invokes cargo with the correct `wasm32-unknown-unknown` target and release profile to produce an optimized `.wasm` file.
- **For Objective Programs (Noir):** Acts as a wrapper for the blocksense-noir compiler, using settings from `Blocksense.toml` and `Prover.toml` to generate the ACIR and ABI files.
- **Dependency Check:** If the blocksense-noir compiler is required but not found in the system's PATH, the command will fail gracefully with a clear diagnostic message and installation instructions.

### **blocksense run**

Performs a single, one-off execution of a compiled oracle service or ZK circuit. This is useful for quick checks and debugging without deploying to a network.

**Usage:**

```bash
blocksense run
```

**Arguments:**

- `<PATH>` (Optional): The path to the project or component to run. Defaults to the current directory. If the project is not yet built, `blocksense run` will trigger a build first.

**Output:**

The command executes the program's main function (e.g., the query function for an oracle service) and prints the results and any logs directly to the terminal.

### **blocksense test**

Runs the complete test suite for a project, including unit tests for individual components and end-to-end integration tests.

**Usage:**

```bash
blocksense test
```

**Behavior:**

- **Unit Tests:** Discovers and runs tests written for both Rust oracle services (`#[test]`) and Noir circuits (`#[test]`).
- **Integration Tests:** Can be configured to spin up an ephemeral instance of the localnet environment, deploy the project's programs, execute test scripts against them, and tear down the network upon completion.

### **blocksense debug**

Starts a debugging session using the integrated CodeTracer time-traveling debugger.

**Usage:**

```bash
blocksense debug
```

**Arguments:**

- `<PATH>` (Optional): The path to the program to debug. Defaults to the current directory.

**Behavior:**

The command automates the debugging workflow:

1. Compiles the target program with debug instrumentation.
2. Executes the program to generate a detailed execution trace.
3. Launches the CodeTracer UI with the trace file loaded.

If the `codetracer` executable is not found in the system's PATH, the command will provide a helpful diagnostic message with a link to installation instructions.

### **blocksense deploy**

Deploys compiled program artifacts to a specified Blocksense network.

**Usage:**

```bash
blocksense deploy --network <NETWORK>
```

**Options:**

- `--network <NETWORK>`: (Required) Specifies the target network (e.g., localnet, testnet, mainnet). Network details are configured in `Blocksense.toml`.

**Behavior:**

- **For Objective Programs:** Wraps the `deploy_module` system operation to publish the immutable program code. It can then interactively prompt to create a stateful instance via `create_instance`.
- **For Intersubjective Services:** Deploys the service's WASM bytecode to the Intersubjective Truth Machine, making it available for execution by oracle nodes.

### **blocksense upgrade**

Performs a standard upgrade on a deployed, mutable program instance.

**Usage:**

```bash
blocksense upgrade --network <NETWORK> <INSTANCE_ID> <NEW_MODULE_ADDRESS>
```

**Arguments:**

- `<INSTANCE_ID>`: The on-chain ID of the mutable program instance to be upgraded.
- `<NEW_MODULE_ADDRESS>`: The address of the new program module to upgrade to.

**Behavior:**

Constructs and submits the upgrade transaction to the specified network after showing the user a confirmation summary.

### **blocksense localnet**

Manages the local simulation environment, which includes a Blocksense dev node and emulators for target networks like Ethereum.

**Usage:**

```bash
blocksense localnet <SUBCOMMAND>
```

**Subcommands:**

- `start`: Starts the complete local network stack as defined in the orchestration configuration (Process Compose or Docker Compose).
  - `--fork <NETWORK_URL>`: (Optional) Starts the localnet in a "shadow fork" mode, cloning the state of a live public network from the specified JSON-RPC URL.
  - `--fork-block-number <NUMBER>`: (Optional) Used with `--fork` to pin the forked state to a specific block number, ensuring deterministic test runs.
- `stop`: Stops all services managed by the localnet.
- `status`: Displays the current status of all localnet services.

### **blocksense account**

Manages local accounts used for development and testing.

**Usage:**

```bash
blocksense account <SUBCOMMAND>
```

**Subcommands:**

- `new`: Creates a new keypair and saves it locally.
- `list`: Lists all locally managed accounts.
- `balance <ACCOUNT>`: Checks the balance of a specified account on a given network.

## **Works Cited**

[^1]: [[Blocksense Litepaper|blocksense-litepaper]] - Core protocol overview and design principles

[^2]: [Blocksense GitHub Repository](https://github.com/blocksense-network) - Official source code

[^3]: [Noir Language](https://github.com/noir-lang/noir) - Domain specific language for zero knowledge proofs

[^4]: [Noir Documentation](https://noir-lang.org/) - Official Noir language documentation

[^5]: [CodeTracer](https://opencollective.com/codetracer) - Time-travelling debugger

[^6]: [CodeTracer Introduction](https://forum.nim-lang.org/t/12703) - Forum discussion and introduction

[^7]: [CodeTracer Demo](https://www.youtube.com/watch?v=xZsJ55JVqmU) - YouTube demonstration

[^8]: [Oracle Pallet](https://github.com/diadata-org/oracle-pallet) - Reference implementation

[^9]: [Process Compose Flake](https://community.flake.parts/process-compose-flake) - Process management using process-compose-flake

[^10]: [Process Compose](https://devenv.sh/supported-process-managers/process-compose/) - Process manager documentation

[^11]: [Docker Compose](https://docs.docker.com/compose/intro/compose-application-model/) - How Compose works

[^12]: [Hardhat Forking](https://www.quicknode.com/guides/ethereum-development/smart-contracts/how-to-fork-ethereum-mainnet-with-hardhat) - How To Fork Ethereum Mainnet with Hardhat

[^13]: [Hardhat Network Forking](https://hardhat.org/hardhat-network/docs/guides/forking-other-networks) - Forking other networks
