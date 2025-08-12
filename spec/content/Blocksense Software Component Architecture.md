# **Blocksense Software Component Architecture**

## **1\. Philosophy: A Modular Ecosystem for Agility and Security**

The Blocksense platform is engineered as a collection of discrete, specialized software components rather than a single monolithic application. This modular architecture is a deliberate design choice aimed at achieving several critical goals:

- **Accelerated Development Cycles:** By breaking the system into smaller, independent components, our development teams can achieve significantly faster build, link, and test cycles. This agility allows for more rapid iteration, easier debugging, and quicker delivery of new features and security patches.
- **Enhanced Security through Isolation:** Separating components based on their function allows us to apply the principle of least privilege rigorously. Critical components, such as the credentials manager, can be run in highly isolated environments with minimal attack surfaces.
- **Resource Efficiency and Flexibility:** Node operators only need to run the specific software components required for the duties they are assigned. A node with only oracle duties does not need to run the prover software, leading to more efficient resource utilization.

All components are designed to run within **BlocksenseOS**, a specialized, minimal operating system that provides a secure and verifiable foundation for the entire stack.

## **2\. Core Infrastructure Components**

These components form the foundational layer of any Blocksense node, managing configuration, security, and interaction with the network.

### **2.1. Blocksense Daemon (blocksensed)**

The blocksensed process is the central nervous system of a Blocksense node. It acts as a long-running service responsible for orchestrating all other components.

- **Responsibilities:**
  - Loads the node operator's configuration.
  - Manages the node's identity and participates in the on-chain bidding process for duties.
  - Monitors the blockchain for duty assignments (e.g., being selected for a zkSchellingCoin committee or assigned simulator/prover tasks).
  - Provides a secure RPC interface for submitting transactions to the network.
  - Acts as a process manager: when a new duty is assigned, blocksensed is responsible for fetching the latest version of the required duty-specific software (e.g., blocksense-oracle-runtime) and launching it in a new, isolated process.

### **2.2. Credentials Manager (blocksense-creds)**

The blocksense-creds process is a highly specialized and hardened component with a single responsibility: to securely store and use the node's sensitive private keys.

- **Responsibilities:**
  - Holds the node's primary private key for signing transactions and participating in consensus.
  - Exposes a minimal, local-only IPC (Inter-Process Communication) interface to blocksensed.
- **Security Design:**
  - blocksense-creds is designed to be completely isolated from the public internet. It only communicates with the blocksensed daemon on the local machine.
  - Any potential exploit would require a two-stage attack: first compromising the main blocksensed daemon, and then leveraging a second, separate exploit against the hardened blocksense-creds process. This significantly raises the bar for an attacker to gain access to private keys.

### **2.3. Blocksense CLI (blocksense)**

The blocksense binary is the primary interface for developers. It is a client application that interacts with blocksensed and orchestrates the various developer toolchain components.

- **Responsibilities:**
  - Provides a unified command center for project initialization, building, testing, and deployment.
  - Communicates with the local blocksensed daemon to submit transactions or query network state.
  - Invokes other specialized components, such as the blocksense-noir compiler, as needed during the development workflow.

## **3\. Duty-Specific Components**

These are specialized programs that are launched by blocksensed only when the node is assigned a corresponding duty.

### **3.1. Oracle Runtime (blocksense-oracle-runtime)**

This component is responsible for executing Intersubjective Services (Oracle Services).

- **Technology:** Built on the Wasmtime WebAssembly runtime, providing a secure, sandboxed environment for executing untrusted oracle code.
- **Function:** Loads and executes the WASM bytecode of an oracle service, providing it with access to the necessary host APIs (e.g., for HTTP requests, caching, and consensus storage) while meticulously metering its resource consumption.

### **3.2. Simulator (blocksense-sim)**

This component is launched when the node is assigned duties as an Execution Layer Simulator.

- **Function:** Receives ordered batches of transactions from the Ordering Layer. It is responsible for applying the state transition logic for these transactions in a deterministic manner, handling the object-locking protocol, and identifying transactions that need to be postponed due to contention.

### **3.3. Prover (blocksense-prover)**

This component is launched when the node is assigned duties as a ZK Prover.

- **Function:** Takes the execution trace from a Simulator and generates a succinct ZK proof of the computation. This is a computationally intensive task that often leverages specialized hardware (e.g., GPUs, FPGAs) to accelerate the proof generation process.

## **4\. Developer Toolchain Components**

These components are part of the Blocksense SDK and are typically invoked by the blocksense CLI during development.

### **4.1. Noir Compiler (blocksense-noir)**

The official compiler for the Blocksense Noir language, used to develop Objective Programs (ZK circuits).

- **Function:** Compiles high-level .nr source code into a verifiable ZK circuit format (ACIR) that can be executed and proven by the Blocksense network. The blocksense build command acts as a user-friendly wrapper around this compiler.

## **5\. Component Interaction Diagram**

The following diagram illustrates the high-level interactions between the core components of a Blocksense node.
\+---------------------------------+
| Developer (via Shell) |
\+---------------------------------+
|
v
\+---------------------------------+
| Blocksense CLI (\`blocksense\`) |
\+---------------------------------+
| (RPC)
v
\+---------------------------------+ \+------------------------------------------+
| Blocksense Daemon (\`blocksensed\`)|-----\>| Blocksense Network (Peers/Consensus) |
| |\<-----| |
| \- Manages Config & Duties | \+------------------------------------------+
| \- Launches Duty Components |
\+---------------------------------+
| (IPC) | (Launches Process)
v \+-------------------\> \[ Duty-Specific Components \]
\+---------------------+ |
| Credentials Manager | | e.g., blocksense-oracle-runtime
| (\`blocksense-creds\`)| | blocksense-sim
| \- Holds Keys | | blocksense-prover
| \- Signs Payloads | |
\+---------------------+ \+------------------------------------------+

This modular architecture ensures that Blocksense is not only powerful and scalable but also secure, flexible, and easy to develop for and maintain.
