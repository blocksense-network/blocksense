# **Blocksense SDK: Oracle Service Costing, Concurrency, and Pricing Markets**

The Blocksense network is designed as a global, unified marketplace for verified computation.[^1] For this marketplace to function efficiently and fairly, the "cost" of any computation must be measured objectively and transparently. This principle is central to the design of Intersubjective Services (Oracle Services).

This document details how the Blocksense runtime measures the cost of oracle execution, how developers can define custom cost metrics for complex tasks, and how these mechanisms create a competitive pricing market for oracle services.

## **1\. Objective Cost Measurement**

To prevent subjective or hardware-dependent pricing, Blocksense employs a multi-faceted approach to resource measurement. The final "cost" of an oracle query is a combination of its intrinsic computational work and any external resources it consumes.

### **1.1. Intrinsic Cost: WebAssembly Metering**

Every oracle service runs within a sandboxed WebAssembly (WASM) runtime on the Blocksense node. This runtime is instrumented to meticulously track the resources consumed during each query invocation. The primary metrics are:

- **Retired Instructions:** The total number of WASM instructions executed. This is a hardware-agnostic measure of pure computational effort.
- **Memory Used:** The amount of memory consumed by the WebAssembly module during execution.
- **Internet Bandwidth:** The volume of data transferred over the network (e.g., for API calls).

These intrinsic costs are measured automatically by the runtime for every execution. When a Blocksense node reports the result of an oracle query, it reports these measured costs alongside the result. The Schelling point consensus mechanism then applies to both the data result and the reported cost, incentivizing all nodes to report these objective measurements honestly.[^1]

### **1.2. Extensible Cost: External Programs and Custom Units**

Many advanced oracle services rely on external programs to perform specialized tasks. Blocksense allows an oracle service to declare a dependency on such an external program, which is identified by its content hash.

The critical requirement is that this external program **must produce an objective, hardware-independent measure of its own "cost."** This is not a measure of time, but a deterministic unit relevant to the task. Examples include:

- **Gas:** For a program that simulates an EVM transaction.
- **Input and Output Tokens:** For a service that queries a large language model.
- **Software Counters:** Any custom, deterministic counter defined by the program's logic.

The Blocksense node executes this external program, collects the cost measurement it produces, and reports this value as part of the total cost for the oracle query. This allows the Blocksense economic model to transparently price and reward arbitrarily complex, specialized computations.

## **2\. The Pricing Market for Oracle Services**

The objective cost measurements form the basis of a competitive, market-driven ecosystem for providing oracle services.[^1]

- **Service Bidding:** Node operators who wish to run oracle services participate in a bidding system. They bid on their willingness to provide computation at a certain price per cost unit (e.g., price per million retired instructions).
- **Incentivizing Efficiency:** The protocol prioritizes tasks for operators who offer cheaper service. This creates a powerful economic incentive for operators to optimize their infrastructure and report costs honestly. An operator who can perform a computation more efficiently (i.e., for a lower cost) will receive more data reporting tasks and, consequently, more rewards.

This market dynamic ensures that the price of verified computation on Blocksense is driven down by open competition, benefiting the dApps and users who consume these services.

## **3\. Advanced Execution: Concurrency and Shared Memory**

To handle high-frequency data streams and parallelize work, oracle services can leverage advanced execution models, including threading and inter-process communication (IPC) via shared memory. These concurrent tasks are initiated during the one-time setup() phase of the oracle's lifecycle.

### **3.1. WebAssembly Threads**

Within the setup() function, an oracle service can spawn multiple WebAssembly threads. This is ideal for tasks that can be parallelized, such as fetching data from multiple APIs simultaneously. The Blocksense runtime automatically tracks the resource consumption (retired instructions, memory used, internet bandwidth) across all threads and aggregates them into a single, total cost for the query invocation.

### **3.2. External Processes and Shared Memory IPC**

For tasks that require continuous, long-running operation—such as maintaining a live connection to a high-frequency data source—the ideal pattern is to decouple the data ingestion from the on-demand query execution.

**Motivating Example: Real-Time Price Feeds**

Consider an oracle service designed to provide the most up-to-the-second price for a volatile asset. This requires maintaining persistent WebSocket connections to multiple cryptocurrency exchanges, a task ill-suited for the synchronous, request-response model of the query function.

The Blocksense architecture solves this with a powerful pattern:

1. **Launch in setup():** In the setup() hook, the oracle service launches a long-running external process. This process is responsible for establishing and maintaining WebSocket connections to multiple exchanges.
2. **Shared Memory:** The external process and the main oracle service communicate via a standardized shared memory API. This API allows the external process to write data into a well-defined, in-memory table.
3. **Decoupled Workflow:**
   - The **external process** runs asynchronously, constantly updating the shared memory table with the latest price ticks from all connected exchanges. Crucially, it also measures its own resource consumption (e.g., bandwidth used) and writes this cost metric into the shared table alongside the price data.
   - The oracle's main **query function** becomes extremely lightweight. When invoked, its only job is to read the latest aggregated value and its associated cost from the shared memory table and return them.

This architecture effectively separates the high-frequency, asynchronous data ingestion from the synchronous, on-demand query processing. It allows the oracle to provide extremely low-latency data while ensuring that the cost of the query function itself remains minimal and predictable.

## **4\. API for Reporting Custom Costs**

To formally support the reporting of custom cost units from external programs, the Blocksense SDK provides a clear and enforceable API. The metadata for the oracle service declares the custom cost units it will report. The query function must then return a struct where specific fields are annotated to correspond to these declared units.

This forces the oracle to report these costs on every invocation, making them an integral part of the service's output.

**Conceptual API Example:**

An oracle service that uses an external process to track WebSocket data might define its return type as follows:

```rust
// In the oracle's metadata, a custom cost unit is declared:
// custom_costs = ["websocket_bandwidth_bytes"]

// The return struct for the query function.
pub struct PriceFeedResult {
    // The primary data result of the query.
    pub price: u64,
    pub timestamp: u64,

    // This field is annotated as a cost unit. The runtime will parse this
    // and include it in the final cost report for the query.
    #[cost_unit(name = "websocket_bandwidth_bytes")]
    pub bandwidth_used: u64,
}

// The implementation of the query function.
pub fn query(params: Vec<u8>) -> PriceFeedResult {
    // Read the latest price and the measured bandwidth cost
    // from the shared memory table populated by the external process.
    let (latest_price, bandwidth) = read_from_shared_memory();

    PriceFeedResult {
        price: latest_price,
        timestamp: get_current_time(),
        bandwidth_used: bandwidth,
    }
}
```

This annotation-based system provides a strongly-typed, explicit, and verifiable way for oracle services to report their extensible costs, ensuring the integrity of the network's pricing markets.

## **Works Cited**

[^1]: [[Blocksense Litepaper|blocksense-litepaper]] - Core protocol overview and design principles
