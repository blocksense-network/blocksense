# **Blocksense SDK: Oracle Service Lifecycle & Storage APIs**

Intersubjective Services (Oracle Services) on Blocksense are designed to be powerful, long-running, and stateful applications. They often need to perform complex, resource-intensive tasks that go beyond simple data fetching. To support these advanced use cases, the Blocksense SDK provides a well-defined execution lifecycle and a sophisticated storage model that allows developers to manage performance and on-chain consensus with precision.

## **1\. The Oracle Service Lifecycle**

Many advanced oracle services require an expensive, one-time setup. For example, a parametric insurance oracle designed to automatically settle claims for cargo ships must first process vast amounts of geographical and historical weather data to build a baseline risk model. Performing this setup for every single query would be prohibitively slow and costly.

To solve this, Blocksense recognizes that zkSchellingCoin committee members (the nodes that run oracle services) are assigned their duties for prolonged periods, often several hours at a time.[^1] This stability makes it economically viable to perform an initial setup. The SDK exposes this capability through a simple three-stage lifecycle, allowing developers to amortize the cost of expensive initializations over thousands of subsequent queries.

### **1.1. Lifecycle Hooks**

An oracle service is structured around three core functions, or "hooks," that the developer implements. The oracle service runtime keeps the WebAssembly module instance alive between query calls, allowing state to be maintained in memory.

- **setup():** This function is called **once** when a new instance of the oracle service is initialized on a node. It is the ideal place for performing one-time, expensive setup tasks, such as creating temporary files in the cache, or spawning long-running WebAssembly threads and external processes.
  - **Use Case (Parametric Insurance Oracle):** The setup() function would download large datasets, such as global shipping lane maps (GIS data) and historical hurricane track data. It would then write this data to files in the local cache and load it into an efficient, queryable data structure in the WebAssembly module's memory.
- **query(params: Vec<u8>) -> Vec<u8>:** This is the primary function of the service and is invoked for **every individual data request**. It receives request-specific parameters from the objective layer (e.g., a specific policy ID to evaluate) and is responsible for executing the core logic and returning a result.
  - **Use Case (Parametric Insurance Oracle):** The query() function would take a policy ID as input. It would then fetch real-time data for the associated vessel, such as its current GPS location. It would compare this live data against the in-memory risk models (loaded from the cache during setup) to determine if a trigger event has occurred and return the outcome.
- **teardown():** This function is called **once** when a service instance is being shut down or decommissioned on a node. It allows for the graceful cleanup of any resources allocated in the setup() phase that are not managed automatically by the system.

## **2\. The Multi-Tiered Storage Model**

Oracle services have diverse storage needs, ranging from temporary files for a single run, to consensus-critical on-chain state, to persistent, evolving off-chain databases. The Blocksense SDK addresses this with a multi-tiered storage model.

### **2.1. Tier 1: Ephemeral File System Cache**

For most use cases, oracle services need a temporary place to store data required for their operation. The SDK provides this through a sandboxed, ephemeral file system that is modeled as a standard file-system API. This design allows developers to use existing Rust libraries that read from and write to the file system without modification.

- **Characteristics:**
  - **Standard API:** Interacting with the cache feels like using a normal file system, enhancing developer productivity.
  - **Lifecycle-Managed:** Oracle services can **only create new files within the setup() function**. These files are then available for reading by the query function and any WebAssembly threads spawned during setup.
  - **Automatic Cleanup:** The system automatically deletes all files created in the cache when the oracle service instance is terminated. Developers do not need to manually clean up these files in the teardown() hook.
  - **Portability:** This caching mechanism is recommended for creating highly portable oracle services that can be easily migrated from one machine to another, as their required state is self-contained and created at startup.

### **2.2. Tier 2: Consensus Storage API (storage::\*)**

Consensus Storage is used for persistent data that is an integral part of the oracle's result.

A critical distinction must be made: while the primary result of a query function can be aggregated using various consensus algorithms (e.g., median, trimmed mean), any write operation to Consensus Storage is **always handled under the "exact match" consensus algorithm**. All reporting nodes must agree on the exact sequence and content of these writes for consensus to be reached.

Because of this strict requirement, writing to Consensus Storage is recommended only for intersubjective truths that are almost objectively defined. These are values that, despite potentially depending on external factors like internet access, are expected to be identical across all honest reporting nodes.

- **Use Cases:**
  - An oracle tracking a GitHub repository could write the latest commit hash to consensus storage.
  - A service that processes a sequence of events could store the ID of the last processed event to prevent duplicates.
  - An oracle monitoring a specific satellite feed could store the hash of the latest processed image tile to ensure no data is missed or re-processed.
- **Conceptual API:**

```rust
// Writes a key-value pair to consensus storage. This action becomes part of the transaction result.
fn storage::write(key: Vec<u8>, value: Vec<u8>);

// Reads a value from the consensus state.
fn storage::read(key: Vec<u8>) -> Option<Vec<u8>>;
```

### **2.3. Tier 3: Persistent Storage via Self-Elected Capabilities**

Some oracle services require access to large, persistent, and constantly evolving datasets that would be impractical to set up from scratch for every instance. A prime example is an oracle that needs to query the state of a full Ethereum node.

This is best modeled as a **self-elected capability**. Instead of a generic storage API, this represents a specialized service that a node operator explicitly chooses to provide.

- **Mechanism:** A node operator can elect to run and maintain the necessary infrastructure (e.g., a full Ethereum client). The oracle service can then declare a dependency on this capability in its metadata.
- **Custom Cost Model:** Services that rely on these capabilities define their own custom cost models. The cost is not based on standard WASM metering but on metrics relevant to the service (e.g., cost per database query, cost per block data read). This allows the Blocksense marketplace to accurately price these more complex and resource-intensive services.[^1]

## **3\. A Note on Stateful Logic: The Correct Pattern**

The strict "exact match" requirement for the on-chain Consensus Storage API means it is unsuitable for values that may have slight variations between nodes, such as a calculated price from different API sources. Attempting to write such a value to storage would likely lead to consensus failure.

The correct architectural pattern for managing such state involves a clear separation of concerns between the intersubjective and objective layers:

1. **Intersubjective Layer (Oracle Service):** The insurance oracle service determines if a specific policy should be paid out (e.g., it encountered a hurricane). It returns a structured result like {"policy_id": "XYZ", "payout_due": true}. The consensus method for this result could be a simple majority vote.
2. **Consensus:** The zkSchellingCoin mechanism establishes a final, agreed-upon result from the reports of all committee members.[^1]
3. **Objective Layer (ZK Program):** The main insurance dApp contract receives this single, finalized result. It is this program—not the oracle service—that is responsible for managing the application's state. It can, for example, update a stateful object it owns that tracks the total number of claims paid out in a specific region.
4. **Data Flow:** If the oracle needed to know about past payouts to adjust its risk model, the Objective Program would pass that historical data _into_ the next query call as a parameter.

This pattern correctly places the responsibility of state management on the deterministic Objective Layer, while using the Intersubjective Layer for its core purpose: establishing consensus on external, non-deterministic information.

## **Works Cited**

[^1]: [[Blocksense Litepaper|blocksense-litepaper]] - Core protocol overview and design principles
