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

- \--help, \-h: Displays help information for the specified command.
- \--version, \-V: Displays the current version of the blocksense CLI.

---

## **Command Reference**

The following sections provide a detailed reference for each of the main blocksense commands.

### **blocksense init**

Initializes a new Blocksense project from a predefined or custom template. This command scaffolds a complete directory structure, including boilerplate code and configuration files, so you can start developing immediately.

**Usage:**

Bash

blocksense init \<TEMPLATE\> \<PROJECT_NAME\>

**Arguments:**

- \<TEMPLATE\>: The name of the template to use. This can be one of the official templates or a URL to a custom Git repository.
- \<PROJECT_NAME\>: The name of the new directory to create for your project.

**Official Templates:**

- oracle-service-rust: A minimal "hello world" Intersubjective Service in Rust, including a basic query function and unit test.
- price-feed-oracle: A comprehensive price feed example demonstrating API fetching, advanced consensus models, and caching.
- objective-program-noir: A minimal ZK circuit project using Blocksense Noir, including a simple circuit and test case. 1
- zk-identity-service: A template for building a custom, ZK-powered identity service, showcasing the authorize_user API.
- full-stack-dapp: A complete end-to-end example including an oracle service, an objective program, a frontend, and localnet configuration.

**Output:**

The init command generates a new directory containing the selected template's files and a central Blocksense.toml configuration file. This manifest is used to configure builds, tests, deployments, and local network settings.

### **blocksense build**

Compiles all components within a project directory into deployable artifacts. The command automatically detects whether to build an Intersubjective Service or an Objective Program based on the project's structure and configuration.

**Usage:**

Bash

blocksense build

**Arguments:**

- \`\` (Optional): The path to the project or component to build. Defaults to the current directory.

**Behavior:**

- **For Intersubjective Services (Rust):** Invokes cargo with the correct wasm32-unknown-unknown target and release profile to produce an optimized .wasm file.
- **For Objective Programs (Noir):** Acts as a wrapper for the blocksense-noir compiler, using settings from Blocksense.toml and Prover.toml to generate the ACIR and ABI files. 1
- **Dependency Check:** If the blocksense-noir compiler is required but not found in the system's PATH, the command will fail gracefully with a clear diagnostic message and installation instructions.

### **blocksense run**

Performs a single, one-off execution of a compiled oracle service or ZK circuit. This is useful for quick checks and debugging without deploying to a network.

**Usage:**

Bash

blocksense run

**Arguments:**

- \`\` (Optional): The path to the project or component to run. Defaults to the current directory. If the project is not yet built, blocksense run will trigger a build first.

**Output:**

The command executes the program's main function (e.g., the query function for an oracle service) and prints the results and any logs directly to the terminal.

### **blocksense test**

Runs the complete test suite for a project, including unit tests for individual components and end-to-end integration tests.

**Usage:**

Bash

blocksense test

**Behavior:**

- **Unit Tests:** Discovers and runs tests written for both Rust oracle services (\#\[test\]) and Noir circuits (\#\[test\]).
- **Integration Tests:** Can be configured to spin up an ephemeral instance of the localnet environment, deploy the project's programs, execute test scripts against them, and tear down the network upon completion.

### **blocksense debug**

Starts a debugging session using the integrated CodeTracer time-traveling debugger. 4

**Usage:**

Bash

blocksense debug

**Arguments:**

- \`\` (Optional): The path to the program to debug. Defaults to the current directory.

**Behavior:**

The command automates the debugging workflow:

1. Compiles the target program with debug instrumentation.
2. Executes the program to generate a detailed execution trace.
3. Launches the CodeTracer UI with the trace file loaded.

If the codetracer executable is not found in the system's PATH, the command will provide a helpful diagnostic message with a link to installation instructions. 7

### **blocksense deploy**

Deploys compiled program artifacts to a specified Blocksense network.

**Usage:**

Bash

blocksense deploy \--network \<NETWORK\>

**Options:**

- \--network \<NETWORK\>: (Required) Specifies the target network (e.g., localnet, testnet, mainnet). Network details are configured in Blocksense.toml.

**Behavior:**

- **For Objective Programs:** Wraps the deploy_module system operation to publish the immutable program code. It can then interactively prompt to create a stateful instance via create_instance.
- **For Intersubjective Services:** Deploys the service's WASM bytecode to the Intersubjective Truth Machine, making it available for execution by oracle nodes.

### **blocksense upgrade**

Performs a standard upgrade on a deployed, mutable program instance.

**Usage:**

Bash

blocksense upgrade \--network \<NETWORK\> \<INSTANCE_ID\> \<NEW_MODULE_ADDRESS\>

**Arguments:**

- \<INSTANCE_ID\>: The on-chain ID of the mutable program instance to be upgraded.
- \<NEW_MODULE_ADDRESS\>: The address of the new program module to upgrade to.

**Behavior:**

Constructs and submits the upgrade transaction to the specified network after showing the user a confirmation summary.

### **blocksense localnet**

Manages the local simulation environment, which includes a Blocksense dev node and emulators for target networks like Ethereum. 8

**Usage:**

Bash

blocksense localnet \<SUBCOMMAND\>

**Subcommands:**

- start: Starts the complete local network stack as defined in the orchestration configuration (Process Compose or Docker Compose). 9
  - \--fork \<NETWORK_URL\>: (Optional) Starts the localnet in a "shadow fork" mode, cloning the state of a live public network from the specified JSON-RPC URL. 12
  - \--fork-block-number \<NUMBER\>: (Optional) Used with \--fork to pin the forked state to a specific block number, ensuring deterministic test runs.
- stop: Stops all services managed by the localnet.
- status: Displays the current status of all localnet services.

### **blocksense account**

Manages local accounts used for development and testing.

**Usage:**

Bash

blocksense account \<SUBCOMMAND\>

**Subcommands:**

- new: Creates a new keypair and saves it locally.
- list: Lists all locally managed accounts.
- balance \<ACCOUNT\>: Checks the balance of a specified account on a given network.

#### **Works cited**

1. Blocksense \- GitHub, accessed July 31, 2025, [https://github.com/blocksense-network](https://github.com/blocksense-network)
2. Noir is a domain specific language for zero knowledge proofs \- GitHub, accessed July 31, 2025, [https://github.com/noir-lang/noir](https://github.com/noir-lang/noir)
3. Noir Documentation, accessed July 31, 2025, [https://noir-lang.org/](https://noir-lang.org/)
4. CodeTracer \- Open Collective, accessed July 31, 2025, [https://opencollective.com/codetracer](https://opencollective.com/codetracer)
5. Introducing CodeTracer \- a time-travelling debugger built with Nim, for Nim., accessed July 31, 2025, [https://forum.nim-lang.org/t/12703](https://forum.nim-lang.org/t/12703)
6. CodeTracer \- Noir Release Demo \- YouTube, accessed July 31, 2025, [https://www.youtube.com/watch?v=xZsJ55JVqmU](https://www.youtube.com/watch?v=xZsJ55JVqmU)
7. diadata-org/oracle-pallet \- GitHub, accessed July 31, 2025, [https://github.com/diadata-org/oracle-pallet](https://github.com/diadata-org/oracle-pallet)
8. Blocksense\_ A Litepaper for the Universal Verification Layer.pdf
9. Process management using process-compose-flake, accessed July 31, 2025, [https://community.flake.parts/process-compose-flake](https://community.flake.parts/process-compose-flake)
10. Process compose \- devenv, accessed July 31, 2025, [https://devenv.sh/supported-process-managers/process-compose/](https://devenv.sh/supported-process-managers/process-compose/)
11. How Compose works \- Docker Docs, accessed July 31, 2025, [https://docs.docker.com/compose/intro/compose-application-model/](https://docs.docker.com/compose/intro/compose-application-model/)
12. How To Fork Ethereum Mainnet with Hardhat | QuickNode Guides, accessed July 31, 2025, [https://www.quicknode.com/guides/ethereum-development/smart-contracts/how-to-fork-ethereum-mainnet-with-hardhat](https://www.quicknode.com/guides/ethereum-development/smart-contracts/how-to-fork-ethereum-mainnet-with-hardhat)
13. Forking other networks | Ethereum development environment for professionals by Nomic Foundation \- Hardhat, accessed July 31, 2025, [https://hardhat.org/hardhat-network/docs/guides/forking-other-networks](https://hardhat.org/hardhat-network/docs/guides/forking-other-networks)
