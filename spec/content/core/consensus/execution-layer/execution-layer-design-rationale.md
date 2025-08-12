# **The Blocksense Execution Layer: Design Rationale**

## **1\. Introduction: The Boundless Throughput Engine**

The Blocksense Execution Layer is the second core component of our Decoupled State Machine Replication (DSMR) architecture. While the Ordering Layer is responsible for establishing a definitive, global sequence of transactions, the Execution Layer's mission is to process these transactions, apply the resulting state changes, and produce a succinct, verifiable proof of the entire computation. This is the heart of the "Boundless Throughput Engine," designed to overcome the computational bottlenecks that have historically limited blockchain scalability.[^1]

The design of this layer was guided by a set of stringent requirements, drawing inspiration not only from blockchain technology but also from decades of research in high-performance distributed databases.

## **2\. The Core Challenge: Deterministic Execution at Unlimited Scale**

To achieve boundless throughput, the Blocksense network is designed to scale its ordering capacity horizontally by adding more parallel DAG-BFT consensus instances.[^1] The Execution Layer, therefore, faces a unique and demanding challenge: it must be able to correctly process a potentially massive influx of transactions from multiple, independent streams while adhering to the strict rules of blockchain state transition.

This challenge can be broken down into the following core requirements:

- **Deterministic State:** The global state of the Blocksense network must be a deterministic function of the transaction streams provided by the Ordering Layer. Given the same initial state and the same set of ordered transactions, every node must always compute the exact same final state.
- **Atomic and Isolated Execution:** The full set of reads and writes for any given transaction must be executed atomically. The system must prevent race conditions and ensure that concurrent transactions do not interfere with one another, maintaining serializable isolation.
- **Scalable Ingestion:** The Execution Layer must be able to handle an indefinitely increasing number of transaction streams from the Ordering Layer without becoming a bottleneck.
- **Support for Complex Logic:** Transactions contain arbitrary smart contract logic. The execution model must handle cases where the objects a transaction writes to are dependent on the values it first reads.
- **Deterministic Conflict Resolution:** When contention occurs (e.g., two transactions attempting to modify the same data), the mechanism for postponing or resolving the conflict must be fully deterministic. Transaction failure should never be the result of non-deterministic factors like network timing or execution speed.

## **3\. The Architectural Blueprint: A Synthesis of Proven Concepts**

To solve this complex set of problems, the Blocksense Execution Layer employs a "Simulation-First Parallel Pipeline".[^1] This architecture is a novel synthesis of three powerful concepts:

1. **Deterministic Scheduling, inspired by the Calvin Protocol:** We adopt the core principle of the Calvin distributed database protocol: agree on a transaction order _before_ execution begins. This allows us to eliminate the non-determinism and overhead of traditional distributed commit protocols.
2. **Explicit Dependencies via the Object Model:** We leverage an object-centric data model, similar to Sui's, where transactions must explicitly declare the data (objects) they intend to access. This allows the system to statically analyze dependencies and unlock massive parallelism.
3. **Client-Side Pre-Proving:** We shift a portion of the computational work to the client by allowing users to generate ZK proofs for parts of their transactions, particularly the authorization logic. This reduces the verification load on the network and enables an ultra-fast path for simple operations.

These three components work in concert to create a highly parallel, deterministic, and verifiable execution environment.

### **3.1. Component 1: Deterministic Scheduling Inspired by Calvin**

The Calvin protocol's core insight is that by decoupling transaction ordering from execution, you can eliminate the primary source of latency and non-determinism in distributed systems: the two-phase commit. We adapt this principle for the blockchain context.

Once the Ordering Layer delivers a finalized, globally ordered batch of transactions, the Execution Layer begins its work. This is handled by a class of nodes called **Simulators**.[^1]

1. **Batch Ingestion:** Simulators receive the ordered batch of transactions for the current epoch (e.g., a 10ms time slice).
2. **Deterministic Locking and Execution:** The Simulators process the transactions strictly according to the pre-agreed global order. A deterministic locking protocol ensures that if two transactions in the batch contend for the same shared object, the transaction that appears earlier in the sequence acquires the lock first.
3. **Conflict Resolution:** If a transaction attempts to acquire a lock held by a preceding transaction within the same batch, it is deterministically postponed. A "skip" proof is generated, and the transaction is rescheduled for the next execution batch with an increased reward to prevent starvation.[^1]

Because the order is already known, this entire process is perfectly deterministic. Every honest Simulator node, given the same input batch, will produce the exact same set of state changes and postponed transactions, without needing to communicate with other nodes during execution.

### **3.2. Component 2: Unlocking Parallelism with the Object Model**

While the Calvin-inspired approach provides determinism, the key to achieving massive throughput is parallel execution. This is where the object model becomes critical. By requiring every transaction to explicitly list the objects it reads from and writes to, we can build a dependency graph for an entire batch of transactions before execution begins.

This enables two distinct execution paths:

- **The Fast Path (Parallel Execution):** The vast majority of blockchain transactions (e.g., asset transfers, NFT mints) involve only **owned objects**, which can only be modified by their owner. Since these transactions have no overlapping state dependencies, they are causally independent and can be executed and proven in parallel by the Simulators. This is the primary driver of Blocksense's scalability.
- **The Consensus Path (Sequential Execution):** Transactions that involve **shared objects** (e.g., interacting with a central AMM contract) are prone to contention. These are the transactions that rely on the deterministic locking mechanism described above. They are executed sequentially within the batch to ensure a consistent outcome.

This hybrid model allows Blocksense to process the bulk of transactions with maximum parallelism while handling contentious operations with deterministic safety.

### **3.3. Component 3: Accelerating the Pipeline with Client-Side Pre-Proving**

To further optimize the pipeline and reduce the load on network nodes, Blocksense introduces a mechanism for client-side pre-proving. The network's use of Incrementally Verifiable Computation (IVC) breaks execution down into small, provable steps, some of which can be performed by the user themselves.

- **Pre-Proving Authorization:** The first step of any transaction is verifying the user's authority to execute it. This is typically a self-contained computation (e.g., checking a signature or a ZK proof against an IdentityService). Users can generate a ZK proof for this authorization step on their own device. This pre-generated proof is submitted with the transaction, allowing the mempool to verify it much more cheaply than simulating the authorization logic itself.
- **The Ultimate Fast Path: Fully Pre-Proven Transactions:** For simple "fast path" transactions, such as transferring an owned object, the entire state transition can be proven client-side. The user can construct a ZK proof that demonstrates: "I am the authorized owner of this object, and I have correctly applied the state transition to transfer it to a new owner."
- **The Execution Layer as a "Proof Stitcher":** When the Execution Layer receives a batch containing these fully pre-proven transactions, its job is dramatically simplified. Instead of executing and proving the logic from scratch, it merely needs to verify the client-provided proofs and "stitch" the resulting state changes into the global state tree. This offloads the majority of the computational work for simple transactions from the network to the end-user, further enhancing scalability.

## **4\. The Power of Incrementally Verifiable Computation (IVC)**

The entire proving stage of the Execution Layer is built upon a powerful cryptographic primitive known as **Incrementally Verifiable Computation (IVC)**.[^2] IVC is a technique that allows a long sequence of computations to be proven in a highly efficient and scalable manner.[^3]

### **4.1. What is IVC?**

Imagine you have a program that runs for a million steps. Proving the entire execution in one go would require a massive amount of memory and computational power. IVC solves this by breaking the problem down.[^4]

At its core, IVC allows a prover to demonstrate that a configuration x₀ correctly transitions to a final configuration x_T after T repeated applications of some function. It does this by generating a chain of proofs. A proof π_n for step n attests to two facts simultaneously:

1. The computation for step n was performed correctly (i.e., x*n is the correct result of applying the function to x*{n-1}).
2. The proof from the previous step, π\_{n-1}, was valid.

This recursive structure means that verifying the final proof, π_T, is sufficient to verify the integrity of the entire computation chain, from start to finish.[^6] The key benefit is that the size of the proof and the time it takes to update it at each step remain small and constant, regardless of the total number of steps.[^5]

### **4.2. Folding Schemes: The Engine of Efficient IVC**

A naive implementation of IVC, where each step's proof circuit includes a full verifier for the previous step's proof, would be prohibitively expensive. Modern IVC systems, such as Nova, overcome this with a technique called **folding**.[^6]

A folding scheme is a lightweight protocol that takes two instances of a problem (and their corresponding witnesses) and combines them into a single new instance of the same size.[^9] This new "folded" instance is satisfiable only if both original instances were. This process is significantly cheaper than generating and verifying a full ZK proof.

In the context of IVC, instead of verifying a full proof at each step, the system simply _folds_ the claim from the current step into a running "accumulator" instance. The expensive work of generating a final, succinct proof is deferred until the very end of the computation.[^11]

### **4.3. Benefits for the Blocksense Execution Layer**

Integrating IVC is fundamental to the "Boundless Throughput Engine":

- **Massive Parallelism:** IVC allows the enormous task of proving a block's execution to be broken down into millions of small, independent steps. These "leaf" proofs can be generated in parallel by a distributed network of Prover nodes.[^1]

- **Efficient Aggregation:** The individual proofs are then efficiently combined up a tree using a folding scheme, resulting in a single, succinct proof for the entire block's state transition.[^1]

- **Constant Verification Cost:** The final proof remains small and cheap to verify, regardless of the number of transactions in the block. This is essential for our ZK-native bridges and for enabling light clients to sync instantly and securely.[^1]

- **Reduced Memory Overhead:** Provers do not need to hold the entire computation trace in memory at once; they only need to process one step at a time, making the system more accessible to a wider range of hardware.[^12]

## **5\. The ZK Proving Engine: UltraHONK**

The entire Execution Layer is underpinned by a state-of-the-art ZK proving system that uses IVC. The ideal ZK proving system for this architecture must have three key properties:

1. **Fast Leaf Proofs:** Generating proofs for individual execution steps must be extremely fast.
2. **Fast Recursion/Folding:** Combining many small proofs into a single, final proof must be highly efficient.
3. **EVM Verifiability:** The final proof must be directly verifiable on EVM chains without requiring an additional, costly "wrapping" step in another proof system like Groth16.

Currently, the **UltraHONK** proving system, as implemented in the Barretenberg backend, best satisfies these requirements. It offers rapid proof generation and produces proofs that can be verified by a Solidity smart contract, making it ideal for our ZK-native bridging goals. Blocksense actively monitors the rapidly evolving ZK landscape and provides comprehensive benchmarks at **zk-wars.blocksense.network** to ensure we are always leveraging the most efficient and secure technology available.

## **6\. Conclusion**

The Blocksense Execution Layer is a meticulously designed system that achieves boundless throughput by embracing determinism and parallelism. By combining a Calvin-inspired deterministic scheduling model with the explicit dependency information from our object model, we can safely parallelize the vast majority of transactions. The addition of client-side pre-proving further offloads work from the network, creating an ultra-efficient "fast path" for common operations. Underpinned by the powerful and flexible UltraHONK IVC proving system, this architecture constitutes a true Boundless Throughput Engine, capable of executing and verifying transactions at a scale that can support the global economy.

## **Works Cited**

[^1]: [[Blocksense Litepaper|blocksense-litepaper]] - Core protocol overview and design principles

[^2]: [Incrementally Verifiable Computation for NP from Standard Assumptions](<https://simons.berkeley.edu/talks/surya-mathialagan-mit-2025-07-17#:~:text=Incrementally%20verifiable%20computation%20(IVC)%20%5B,%2Ddeterministic>)%20transition%20function%20M.) - Simons Institute, accessed July 31, 2025

[^3]: [Incrementally Verifiable Computation for NP from Standard Assumptions](https://simons.berkeley.edu/talks/surya-mathialagan-mit-2025-07-17) - Simons Institute, accessed July 31, 2025

[^4]: [Recursive Zero-Knowledge Proofs](https://scryptplatform.medium.com/recursive-zero-knowledge-proofs-27f2d934f953) - sCrypt - Medium, accessed July 31, 2025

[^5]: [Incrementally Verifiable Computation for NP from Standard Assumptions](https://www.youtube.com/watch?v=RvaEt9awsTw) - YouTube, accessed July 31, 2025

[^6]: [Zero-knowledge proof composition and recursion. Part 3: Nova](https://www.youtube.com/watch?v=nw4-p1KVphU) - YouTube, accessed July 31, 2025

[^7]: [Zero-knowledge proof composition and recursion. Part 5: PCD, IVC, and Mina](https://www.youtube.com/watch?v=mS2EWydMR3Y) - YouTube, accessed July 31, 2025

[^8]: [Nova Studies I: Exploring Aggregation, Recursion, and Folding](https://blog.zk.link/nova-studies-i-exploring-aggregation-recursion-and-folding-23b9a67000cd) | by zk.Link | zkLinkBlog, accessed July 31, 2025

[^9]: [A Review of Folding Schemes. Introduction](https://eigenlab.medium.com/a-review-of-folding-schemes-a285a790fe2f) | by Eigen Network | Medium, accessed July 31, 2025

[^10]: [Nova: Recursive Zero-Knowledge Arguments from Folding Schemes](https://iacr.org/archive/crypto2022/135070334/135070334.pdf) - IACR, accessed July 31, 2025

[^11]: [Incrementally verifiable computation: NOVA](https://blog.lambdaclass.com/incrementally-verifiable-computation-nova/) - LambdaClass Blog, accessed July 31, 2025

[^12]: [Champagne SuperNova, incrementally verifiable computation](https://blog.lambdaclass.com/champagne-supernova-incrementally-verifiable-computation-2/) - LambdaClass Blog, accessed July 31, 2025
